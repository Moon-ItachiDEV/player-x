#!/usr/bin/env python3
# Remplace l'icône (RT_ICON + RT_GROUP_ICON) d'un ou plusieurs .syso (objet COFF amd64 avec une section .rsrc)
# par les images d'un .ico, sans toucher au reste des ressources (manifeste, version, langues, noms).
#   python3 scripts/syso-icons.py <icon.ico> <fichier.syso> [...] [--ico-out <icon.ico>]
# Règle d'encodage des images (pour la compatibilité) : toute image de moins de 256 px est stockée en DIB 32 bits
# (BGRA + masque AND), seule l'image de 256 px reste en PNG. --ico-out réécrit un .ico avec cette même règle.
# Bibliothèque standard + Pillow seulement (pas de go-winres).
import argparse
import io
import os
import struct
import sys

from PIL import Image

RT_ICON = 3
RT_GROUP_ICON = 14
IMAGE_FILE_MACHINE_AMD64 = 0x8664
IMAGE_REL_AMD64_ADDR32NB = 3
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
DATA_ALIGN = 8


def fail(text):
    print(f'Erreur : {text}', file=sys.stderr)
    sys.exit(1)


def align(n, a):
    return (n + a - 1) // a * a


# ---------------------------------------------------------------------------------------------------------------------
# Lecture du .ico et encodage des images

def read_ico(path):
    # Renvoie une liste [(taille, image RGBA, octets PNG d'origine ou None)] dans l'ordre du fichier
    with open(path, 'rb') as f:
        data = f.read()
    reserved, kind, count = struct.unpack_from('<HHH', data, 0)
    if reserved != 0 or kind != 1 or count == 0:
        fail(f'{path} n\'est pas un .ico valide')
    images = []
    for i in range(count):
        w, h, _, _, _, _, size, offset = struct.unpack_from('<BBBBHHII', data, 6 + 16 * i)
        w = w or 256
        h = h or 256
        if w != h:
            fail(f'{path} : image {i} non carrée ({w}x{h})')
        raw = data[offset:offset + size]
        if len(raw) != size:
            fail(f'{path} : image {i} tronquée')
        if raw.startswith(PNG_SIGNATURE):
            im = Image.open(io.BytesIO(raw))
            im.load()
            png = raw
        else:
            # DIB : décodé par Pillow via un .ico d'une seule image (frame(i) de Pillow ne suit pas l'ordre du fichier)
            one = struct.pack('<HHHBBBBHHII', 0, 1, 1, w % 256, h % 256, 0, 0, 1, 32, len(raw), 22) + raw
            im = Image.open(io.BytesIO(one))
            im.load()
            png = None
        im = im.convert('RGBA')
        if im.size != (w, h):
            fail(f'{path} : image {i} annoncée {w}x{h}, réelle {im.size[0]}x{im.size[1]}')
        images.append((w, im, png))
    sizes = [s for s, _, _ in images]
    if len(set(sizes)) != len(sizes):
        fail(f'{path} : plusieurs images de même taille ({sizes})')
    return images


def encode_dib(im):
    # DIB 32 bits : BITMAPINFOHEADER (hauteur doublée), pixels BGRA de bas en haut, puis masque AND 1 bit
    w, h = im.size
    px = im.tobytes('raw', 'RGBA')
    header = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0, 0, 0, 0, 0, 0)
    xor = bytearray()
    mask_stride = align(w, 32) // 8
    mask = bytearray()
    for y in range(h - 1, -1, -1):
        row = px[y * w * 4:(y + 1) * w * 4]
        mrow = bytearray(mask_stride)
        for x in range(w):
            r, g, b, a = row[x * 4:x * 4 + 4]
            if a == 0:
                # Pixel transparent : couleur nulle et bit du masque à 1
                xor += b'\x00\x00\x00\x00'
                mrow[x >> 3] |= 0x80 >> (x & 7)
            else:
                xor += bytes((b, g, r, a))
        mask += mrow
    body = bytes(xor) + bytes(mask)
    # biSizeImage renseigné (XOR + AND), utile à certains lecteurs
    header = header[:20] + struct.pack('<I', len(body)) + header[24:]
    return header + body


def encode_images(images):
    # Renvoie [(taille, octets)] : PNG pour 256 px, DIB 32 bits sinon
    out = []
    for size, im, png in images:
        if size >= 256:
            if png is None:
                buf = io.BytesIO()
                im.save(buf, 'PNG', optimize=True)
                png = buf.getvalue()
            out.append((size, png))
        else:
            out.append((size, encode_dib(im)))
    return out


def dir_entry(size, length):
    # Champs communs à l'entrée du .ico et à celle du RT_GROUP_ICON (sans le dernier champ)
    b = 0 if size >= 256 else size
    return struct.pack('<BBBBHHI', b, b, 0, 0, 1, 32, length)


def build_ico(encoded):
    out = bytearray(struct.pack('<HHH', 0, 1, len(encoded)))
    offset = 6 + 16 * len(encoded)
    for size, raw in encoded:
        out += dir_entry(size, len(raw)) + struct.pack('<I', offset)
        offset += len(raw)
    for _, raw in encoded:
        out += raw
    return bytes(out)


def build_group(encoded, ids):
    out = bytearray(struct.pack('<HHH', 0, 1, len(encoded)))
    for (size, raw), rid in zip(encoded, ids):
        out += dir_entry(size, len(raw)) + struct.pack('<H', rid)
    return bytes(out)


# ---------------------------------------------------------------------------------------------------------------------
# Arbre de ressources

class Dir:
    def __init__(self, characteristics=0, timestamp=0, major=0, minor=0):
        self.characteristics = characteristics
        self.timestamp = timestamp
        self.major = major
        self.minor = minor
        self.entries = []  # [(clé int ou str, Dir ou Leaf)] dans l'ordre d'écriture


class Leaf:
    def __init__(self, data, codepage=0, reserved=0):
        self.data = data
        self.codepage = codepage
        self.reserved = reserved


def parse_tree(sec):
    # Lit l'arbre ; renvoie la racine et la liste des offsets des champs OffsetToData (cibles des relocations)
    data_fields = []
    seen = set()

    def read_name(off):
        n = struct.unpack_from('<H', sec, off)[0]
        return sec[off + 2:off + 2 + 2 * n].decode('utf-16-le')

    def walk(off, depth):
        if off in seen or depth > 3:
            fail('arbre de ressources invalide (boucle ou profondeur)')
        seen.add(off)
        ch, ts, ma, mi, nn, ni = struct.unpack_from('<IIHHHH', sec, off)
        d = Dir(ch, ts, ma, mi)
        for i in range(nn + ni):
            name, target = struct.unpack_from('<II', sec, off + 16 + 8 * i)
            key = read_name(name & 0x7fffffff) if name & 0x80000000 else name
            if target & 0x80000000:
                child = walk(target & 0x7fffffff, depth + 1)
            else:
                rva, size, cp, res = struct.unpack_from('<IIII', sec, target)
                if rva + size > len(sec):
                    fail('donnée de ressource hors de la section')
                data_fields.append(target)
                child = Leaf(bytes(sec[rva:rva + size]), cp, res)
            d.entries.append((key, child))
        return d

    return walk(0, 0), data_fields


def serialize_tree(root):
    # Disposition : répertoires (en largeur), entrées de données, noms, puis données alignées sur 8 octets.
    # Renvoie (section, offsets des champs OffsetToData), ces champs contenant l'offset dans la section.
    dirs = []
    leaves = []
    names = []
    queue = [root]
    while queue:
        d = queue.pop(0)
        dirs.append(d)
        for key, child in d.entries:
            if isinstance(key, str) and key not in names:
                names.append(key)
            if isinstance(child, Dir):
                queue.append(child)
            else:
                leaves.append(child)
    dir_off = {}
    off = 0
    for d in dirs:
        dir_off[id(d)] = off
        off += 16 + 8 * len(d.entries)
    leaf_off = {}
    for leaf in leaves:
        leaf_off[id(leaf)] = off
        off += 16
    name_off = {}
    for n in names:
        name_off[n] = off
        off += 2 + len(n.encode('utf-16-le'))
    data_off = {}
    for leaf in leaves:
        off = align(off, DATA_ALIGN)
        data_off[id(leaf)] = off
        off += len(leaf.data)
    sec = bytearray(align(off, DATA_ALIGN))
    for d in dirs:
        o = dir_off[id(d)]
        nn = sum(1 for k, _ in d.entries if isinstance(k, str))
        struct.pack_into('<IIHHHH', sec, o, d.characteristics, d.timestamp, d.major, d.minor, nn, len(d.entries) - nn)
        for i, (key, child) in enumerate(d.entries):
            name = (0x80000000 | name_off[key]) if isinstance(key, str) else key
            target = (0x80000000 | dir_off[id(child)]) if isinstance(child, Dir) else leaf_off[id(child)]
            struct.pack_into('<II', sec, o + 16 + 8 * i, name, target)
    for leaf in leaves:
        struct.pack_into('<IIII', sec, leaf_off[id(leaf)], data_off[id(leaf)], len(leaf.data), leaf.codepage,
                         leaf.reserved)
        sec[data_off[id(leaf)]:data_off[id(leaf)] + len(leaf.data)] = leaf.data
    for n in names:
        raw = n.encode('utf-16-le')
        struct.pack_into('<H', sec, name_off[n], len(raw) // 2)
        sec[name_off[n] + 2:name_off[n] + 2 + len(raw)] = raw
    return bytes(sec), [leaf_off[id(leaf)] for leaf in leaves]


def check_entry_order(d):
    # Les noms viennent avant les numéros ; il n'y a pas de doublon
    named = [k for k, _ in d.entries if isinstance(k, str)]
    if d.entries[:len(named)] != [e for e in d.entries if isinstance(e[0], str)]:
        fail('entrées nommées après des entrées numérotées')
    keys = [k for k, _ in d.entries]
    if len(set(keys)) != len(keys):
        fail('entrées en double dans un répertoire de ressources')


def find(d, key):
    for k, child in d.entries:
        if k == key:
            return child
    return None


def replace_icons(root, encoded):
    icons = find(root, RT_ICON)
    groups = find(root, RT_GROUP_ICON)
    if not isinstance(icons, Dir) or not isinstance(groups, Dir):
        fail('pas de RT_ICON ou de RT_GROUP_ICON dans le .syso')
    if len(groups.entries) != 1:
        fail(f'{len(groups.entries)} RT_GROUP_ICON, un seul attendu')
    # Langue et page de code des anciennes images (reprises pour les nouvelles)
    first = icons.entries[0][1]
    if not isinstance(first, Dir) or not first.entries or not isinstance(first.entries[0][1], Leaf):
        fail('RT_ICON mal formé')
    lang, old_leaf = first.entries[0]
    ids = list(range(1, len(encoded) + 1))
    new_dirs = []
    for rid, (_, raw) in zip(ids, encoded):
        sub = Dir(first.characteristics, first.timestamp, first.major, first.minor)
        sub.entries.append((lang, Leaf(raw, old_leaf.codepage, old_leaf.reserved)))
        new_dirs.append((rid, sub))
    icons.entries = new_dirs
    # Le groupe garde son nom/numéro et ses langues ; seules ses données changent
    _, group = groups.entries[0]
    group_data = build_group(encoded, ids)
    for _, leaf in group.entries:
        if not isinstance(leaf, Leaf):
            fail('RT_GROUP_ICON mal formé')
        leaf.data = group_data


# ---------------------------------------------------------------------------------------------------------------------
# Objet COFF

def process_syso(path, encoded):
    with open(path, 'rb') as f:
        data = f.read()
    machine, nsec, ts, symptr, nsym, optsize, chars = struct.unpack_from('<HHIIIHH', data, 0)
    if machine != IMAGE_FILE_MACHINE_AMD64:
        fail(f'{path} : machine 0x{machine:x}, amd64 attendu')
    sections = []
    for i in range(nsec):
        o = 20 + optsize + 40 * i
        name, vsize, va, rawsize, rawptr, relptr, lnptr, nrel, nln, sch = struct.unpack_from('<8sIIIIIIHHI', data, o)
        if nln or lnptr:
            fail(f'{path} : numéros de ligne non gérés')
        sections.append({
            'name': name, 'vsize': vsize, 'va': va, 'chars': sch,
            'data': data[rawptr:rawptr + rawsize] if rawptr else b'',
            'relocs': [struct.unpack_from('<IIH', data, relptr + 10 * k) for k in range(nrel)],
        })
    rsrc = [i for i, s in enumerate(sections) if s['name'].rstrip(b'\x00') == b'.rsrc']
    if len(rsrc) != 1:
        fail(f'{path} : {len(rsrc)} section(s) .rsrc, une seule attendue')
    sec = sections[rsrc[0]]
    root, fields = parse_tree(sec['data'])

    def check(d):
        check_entry_order(d)
        for _, child in d.entries:
            if isinstance(child, Dir):
                check(child)
    check(root)

    # Les relocations doivent viser exactement les champs OffsetToData, avec un seul symbole et le type ADDR32NB
    relocs = sec['relocs']
    if sorted(r[0] for r in relocs) != sorted(fields):
        fail(f'{path} : les relocations ne correspondent pas aux entrées de données')
    if len({(r[1], r[2]) for r in relocs}) != 1 or relocs[0][2] != IMAGE_REL_AMD64_ADDR32NB:
        fail(f'{path} : relocations inattendues')
    sym_index = relocs[0][1]
    if sym_index >= nsym:
        fail(f'{path} : relocation vers un symbole absent')
    sym_value, sym_sec = struct.unpack_from('<Ih', data, symptr + 18 * sym_index + 8)
    # Les champs OffsetToData contiennent l'offset dans la section : le symbole visé doit être le début de .rsrc
    if sym_value != 0 or sym_sec != rsrc[0] + 1:
        fail(f'{path} : les relocations ne visent pas le début de la section .rsrc')

    before = snapshot(root)
    replace_icons(root, encoded)
    after = snapshot(root)
    for key, value in before.items():
        if key[0] not in (RT_ICON, RT_GROUP_ICON) and after.get(key) != value:
            fail(f'{path} : la ressource {key} a changé, ce qui ne devrait pas arriver')

    new_sec, new_fields = serialize_tree(root)
    if len(new_fields) > 0xffff:
        fail(f'{path} : trop de relocations')
    sec['data'] = new_sec
    sec['relocs'] = [(fo, sym_index, IMAGE_REL_AMD64_ADDR32NB) for fo in new_fields]

    # Symboles : on garde tout ; l'enregistrement auxiliaire d'une définition de section (si présent) est mis à jour
    symbols = bytearray(data[symptr:symptr + 18 * nsym])
    k = 0
    while k < nsym:
        sname, value, secnum, stype, sclass, naux = struct.unpack_from('<8sIhHBB', symbols, 18 * k)
        if sclass == 3 and value == 0 and naux >= 1 and secnum == rsrc[0] + 1:
            length, nrel, nln, checksum, number, selection = struct.unpack_from('<IHHIHB', symbols, 18 * (k + 1))
            struct.pack_into('<IHHIHB', symbols, 18 * (k + 1), len(new_sec), len(new_fields), 0, 0, number, selection)
        k += 1 + naux
    strtab = data[symptr + 18 * nsym:]
    if len(strtab) < 4 or struct.unpack_from('<I', strtab, 0)[0] != len(strtab):
        fail(f'{path} : table des chaînes incohérente')

    # Réécriture : en-tête, en-têtes de sections, puis pour chaque section ses données et ses relocations,
    # puis la table des symboles et la table des chaînes (inchangée)
    out = bytearray(data[:20 + optsize])
    out += bytes(40 * nsec)
    for i, s in enumerate(sections):
        rawptr = len(out) if s['data'] else 0
        out += s['data']
        relptr = len(out) if s['relocs'] else 0
        for r in s['relocs']:
            out += struct.pack('<IIH', *r)
        struct.pack_into('<8sIIIIIIHHI', out, 20 + optsize + 40 * i, s['name'], s['vsize'], s['va'], len(s['data']),
                         rawptr, relptr, 0, len(s['relocs']), 0, s['chars'])
    new_symptr = len(out)
    out += symbols
    out += strtab
    struct.pack_into('<HHIIIHH', out, 0, machine, nsec, ts, new_symptr, nsym, optsize, chars)

    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(out)
    os.replace(tmp, path)
    return len(data), len(out)


def snapshot(root):
    # {(type, nom, langue): (données, page de code)} pour comparer avant/après
    out = {}
    for t, d1 in root.entries:
        for n, d2 in (d1.entries if isinstance(d1, Dir) else []):
            for lang, leaf in (d2.entries if isinstance(d2, Dir) else []):
                out[(t, n, lang)] = (leaf.data, leaf.codepage) if isinstance(leaf, Leaf) else None
    return out


def main():
    parser = argparse.ArgumentParser(description='Remplace l\'icône d\'objets .syso par celle d\'un .ico')
    parser.add_argument('ico', help='.ico source (une image par taille)')
    parser.add_argument('syso', nargs='*', help='.syso à modifier sur place')
    parser.add_argument('--ico-out', help='réécrit aussi un .ico selon la même règle (DIB sous 256 px, PNG à 256)')
    args = parser.parse_args()
    if not args.syso and not args.ico_out:
        parser.error('rien à faire : donnez au moins un .syso ou --ico-out')

    images = read_ico(args.ico)
    encoded = encode_images(images)
    print('Images : ' + ', '.join(f'{s} {"PNG" if raw.startswith(PNG_SIGNATURE) else "DIB"}' for s, raw in encoded))
    if args.ico_out:
        ico = build_ico(encoded)
        tmp = args.ico_out + '.tmp'
        with open(tmp, 'wb') as f:
            f.write(ico)
        os.replace(tmp, args.ico_out)
        print(f'{args.ico_out} : {len(ico)} octets')
    for path in args.syso:
        old, new = process_syso(path, encoded)
        print(f'{path} : {old} -> {new} octets')


if __name__ == '__main__':
    main()
