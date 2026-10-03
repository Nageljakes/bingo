import json
import random
import docx
from docx.shared import Pt, RGBColor, Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_shd(cell, hex_color):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_cell_pad(cell, top=60, bottom=60, left=80, right=80):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_tbl_borders(table, color="D1D5DB", sz="4"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideV w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def generate_random_card_matrix(set_data, seed_val=None):
    if seed_val is not None:
        random.seed(seed_val)
    
    # 75-item card (5x5 with free space)
    # B: 5 random from 1-15
    # I: 5 random from 16-30
    # N: 4 random from 31-45 (center is FREE)
    # G: 5 random from 46-60
    # O: 5 random from 61-75
    b_items = [it for it in set_data["items"] if it["col"] == "B"]
    i_items = [it for it in set_data["items"] if it["col"] == "I"]
    n_items = [it for it in set_data["items"] if it["col"] == "N"]
    g_items = [it for it in set_data["items"] if it["col"] == "G"]
    o_items = [it for it in set_data["items"] if it["col"] == "O"]
    
    b_pick = random.sample(b_items, 5)
    i_pick = random.sample(i_items, 5)
    n_pick = random.sample(n_items, 4)
    g_pick = random.sample(g_items, 5)
    o_pick = random.sample(o_items, 5)
    
    # Form 5x5 grid: rows 0 to 4
    matrix = []
    for r in range(5):
        row = []
        row.append(b_pick[r])
        row.append(i_pick[r])
        if r < 2:
            row.append(n_pick[r])
        elif r == 2:
            row.append({"title": "FREE\nBEER", "subtitle": "★ FREE ★", "is_free": True})
        else:
            row.append(n_pick[r - 1])
        row.append(g_pick[r])
        row.append(o_pick[r])
        matrix.append(row)
    return matrix

def build_a4_master_caller_sheet(output_file, set_data):
    doc = docx.Document()
    section = doc.sections[0]
    section.page_width = Mm(210)
    section.page_height = Mm(297)
    section.top_margin = Mm(8)
    section.bottom_margin = Mm(8)
    section.left_margin = Mm(10)
    section.right_margin = Mm(10)
    
    # Header
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = title_p.add_run(f"BEERBOX MIDRAND • PUB BINGO HOST MASTER SHEET")
    r_title.font.bold = True
    r_title.font.size = Pt(13)
    r_title.font.color.rgb = RGBColor(217, 119, 6) # Amber 600
    
    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(4)
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = sub_p.add_run(f"GAME SET: {set_data['name'].upper()} • HOST CALL SHEET & TRACKER")
    r_sub.font.bold = True
    r_sub.font.size = Pt(9.5)
    r_sub.font.color.rgb = RGBColor(75, 85, 99)
    
    # Grid of items (5 columns: B, I, N, G, O with 15 rows)
    col_names = ["B (1-15)", "I (16-30)", "N (31-45)", "G (46-60)", "O (61-75)"]
    table = doc.add_table(rows=16, cols=5)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_tbl_borders(table, color="F59E0B", sz="6")
    
    # Header row
    hdr_cells = table.rows[0].cells
    hdr_colors = ["1E3A8A", "065F46", "92400E", "7C2D12", "581C87"] # Distinct colored columns
    for idx, c in enumerate(hdr_cells):
        set_cell_shd(c, hdr_colors[idx])
        set_cell_pad(c, top=80, bottom=80, left=80, right=80)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(col_names[idx])
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)
    
    # 15 rows of items
    b_items = [it for it in set_data["items"] if it["col"] == "B"]
    i_items = [it for it in set_data["items"] if it["col"] == "I"]
    n_items = [it for it in set_data["items"] if it["col"] == "N"]
    g_items = [it for it in set_data["items"] if it["col"] == "G"]
    o_items = [it for it in set_data["items"] if it["col"] == "O"]
    
    col_lists = [b_items, i_items, n_items, g_items, o_items]
    
    for r in range(15):
        row_cells = table.rows[r + 1].cells
        for col_idx in range(5):
            cell = row_cells[col_idx]
            shd_col = "FEF3C7" if r % 2 == 1 else "FFFFFF"
            set_cell_shd(cell, shd_col)
            set_cell_pad(cell, top=40, bottom=40, left=60, right=60)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            
            if r < len(col_lists[col_idx]):
                item = col_lists[col_idx][r]
                # Checkbox circle + Call
                r_num = p.add_run(f"☐ {item['call']}: ")
                r_num.font.bold = True
                r_num.font.size = Pt(7.5)
                r_num.font.color.rgb = RGBColor(17, 24, 39)
                
                # Title
                r_tit = p.add_run(item.get("title", ""))
                r_tit.font.bold = True
                r_tit.font.size = Pt(7.5)
                r_tit.font.color.rgb = RGBColor(180, 83, 9)
                
                # Subtitle / Rhyme
                sub = item.get("subtitle", "") or item.get("rhyme", "")
                if sub and sub != item.get("title", ""):
                    p2 = cell.add_paragraph()
                    p2.paragraph_format.space_before = Pt(0)
                    p2.paragraph_format.space_after = Pt(0)
                    p2.paragraph_format.line_spacing = 1.0
                    r_sub = p2.add_run(sub[:40])
                    r_sub.font.italic = True
                    r_sub.font.size = Pt(6.5)
                    r_sub.font.color.rgb = RGBColor(107, 114, 128)
    
    # Save
    doc.save(output_file)
    print(f"Created {output_file}")

def build_a4_cards_2up(output_file, set_data, num_pages=5):
    doc = docx.Document()
    section = doc.sections[0]
    section.page_width = Mm(210)
    section.page_height = Mm(297)
    section.top_margin = Mm(8)
    section.bottom_margin = Mm(8)
    section.left_margin = Mm(10)
    section.right_margin = Mm(10)
    
    card_counter = 1001
    
    for pg in range(num_pages):
        for card_idx in range(2):
            card_id = f"BB-{card_counter}"
            card_counter += 1
            matrix = generate_random_card_matrix(set_data, seed_val=card_counter)
            
            # Card Header
            hp = doc.add_paragraph()
            hp.paragraph_format.space_before = Pt(4 if card_idx > 0 else 0)
            hp.paragraph_format.space_after = Pt(1)
            r1 = hp.add_run("BEERBOX MIDRAND • OFFICIAL BINGO CARD")
            r1.font.bold = True
            r1.font.size = Pt(11)
            r1.font.color.rgb = RGBColor(217, 119, 6)
            
            sub = hp.add_run(f"   |   Set: {set_data['name']}   |   Ticket #{card_id}")
            sub.font.bold = False
            sub.font.size = Pt(8.5)
            sub.font.color.rgb = RGBColor(75, 85, 99)
            
            # Table 5x5 with B I N G O Header
            tbl = doc.add_table(rows=6, cols=5)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            set_tbl_borders(tbl, color="D97706", sz="8")
            
            # B-I-N-G-O letters
            letters = ["B", "I", "N", "G", "O"]
            bg_colors = ["1E3A8A", "047857", "B45309", "C2410C", "6D28D9"]
            for idx, c in enumerate(tbl.rows[0].cells):
                set_cell_shd(c, bg_colors[idx])
                set_cell_pad(c, top=60, bottom=60, left=60, right=60)
                p = c.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r = p.add_run(letters[idx])
                r.font.bold = True
                r.font.size = Pt(14)
                r.font.color.rgb = RGBColor(255, 255, 255)
            
            # 5 rows of data
            for row_idx in range(5):
                row_cells = tbl.rows[row_idx + 1].cells
                for col_idx in range(5):
                    cell = row_cells[col_idx]
                    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                    item = matrix[row_idx][col_idx]
                    
                    if item.get("is_free"):
                        set_cell_shd(cell, "FEF3C7")
                        set_cell_pad(cell, top=100, bottom=100, left=40, right=40)
                        p = cell.paragraphs[0]
                        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p.paragraph_format.space_after = Pt(0)
                        run_free = p.add_run("★ FREE ★\nBEERBOX")
                        run_free.font.bold = True
                        run_free.font.size = Pt(8.5)
                        run_free.font.color.rgb = RGBColor(180, 83, 9)
                    else:
                        set_cell_shd(cell, "FFFFFF" if (row_idx + col_idx) % 2 == 0 else "F9FAFB")
                        set_cell_pad(cell, top=70, bottom=70, left=50, right=50)
                        p = cell.paragraphs[0]
                        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p.paragraph_format.space_after = Pt(0)
                        
                        # If classic 75: big number
                        if set_data["type"] == "classic-75":
                            run_num = p.add_run(str(item["id"]))
                            run_num.font.bold = True
                            run_num.font.size = Pt(13)
                            run_num.font.color.rgb = RGBColor(17, 24, 39)
                            
                            sub_text = item.get("rhyme", "") or item.get("title", "")
                            if sub_text:
                                p2 = cell.add_paragraph()
                                p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
                                p2.paragraph_format.space_before = Pt(0)
                                p2.paragraph_format.space_after = Pt(0)
                                run_sub = p2.add_run(sub_text[:20])
                                run_sub.font.size = Pt(6.5)
                                run_sub.font.color.rgb = RGBColor(107, 114, 128)
                        else:
                            # Music or Trivia: show Title and Subtitle
                            run_tit = p.add_run(item.get("title", "")[:28])
                            run_tit.font.bold = True
                            run_tit.font.size = Pt(8)
                            run_tit.font.color.rgb = RGBColor(17, 24, 39)
                            
                            sub_text = item.get("subtitle", "") or item.get("artist", "")
                            if sub_text:
                                p2 = cell.add_paragraph()
                                p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
                                p2.paragraph_format.space_before = Pt(0)
                                p2.paragraph_format.space_after = Pt(0)
                                run_sub = p2.add_run(sub_text[:28])
                                run_sub.font.size = Pt(6.5)
                                run_sub.font.color.rgb = RGBColor(107, 114, 128)
            
            # Card Footer
            fp = doc.add_paragraph()
            fp.paragraph_format.space_before = Pt(1)
            fp.paragraph_format.space_after = Pt(10 if card_idx == 0 else 0)
            r_foot = fp.add_run("HOW TO WIN: Any 1 Line (H/V/D) = Drink Prize  •  Two Lines = Pitcher  •  Full House = Bar Tab!")
            r_foot.font.size = Pt(7.5)
            r_foot.font.color.rgb = RGBColor(107, 114, 128)
            
            # Dotted cut line between card 1 and card 2
            if card_idx == 0:
                cut_p = doc.add_paragraph()
                cut_p.paragraph_format.space_before = Pt(2)
                cut_p.paragraph_format.space_after = Pt(2)
                cut_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_cut = cut_p.add_run("✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - ✂")
                r_cut.font.size = Pt(7)
                r_cut.font.color.rgb = RGBColor(156, 163, 175)
        
        if pg < num_pages - 1:
            doc.add_page_break()
            
    doc.save(output_file)
    print(f"Created {output_file}")

# Load sets
with open("/home/jakes/repos/bingo/bingoSets.json", "r", encoding="utf-8") as f:
    all_sets = json.load(f)

# Build Word Documents
build_a4_master_caller_sheet("/home/jakes/repos/bingo/Beerbox_Pub_Bingo_Host_Master_Caller_Sheet.docx", all_sets[0])
build_a4_cards_2up("/home/jakes/repos/bingo/Beerbox_Pub_Bingo_A4_Cards_Classic_75.docx", all_sets[0], num_pages=5)
build_a4_cards_2up("/home/jakes/repos/bingo/Beerbox_Pub_Bingo_A4_Cards_80s_Music.docx", all_sets[2], num_pages=5)
build_a4_cards_2up("/home/jakes/repos/bingo/Beerbox_Pub_Bingo_A4_Cards_Mzansi_Hits.docx", all_sets[5], num_pages=5)
build_a4_cards_2up("/home/jakes/repos/bingo/Beerbox_Pub_Bingo_A4_Cards_Pub_Trivia.docx", all_sets[8], num_pages=5)
