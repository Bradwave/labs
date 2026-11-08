"""Browser smoke test (Playwright for Python). Usage: python3 tests/smoke.py [url]
Serves the repository on a local port (ES modules do not load from file://), then checks that every scene loads
without JS errors on desktop and phone viewports, in both themes, and that the main features respond."""
import sys, pathlib, subprocess, time
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent.parent  # the repository root: the page loads ../kit
server = None
if len(sys.argv) > 1:
    url = sys.argv[1]
else:
    server = subprocess.Popen([sys.executable, '-m', 'http.server', '8155', '--bind', '127.0.0.1'], cwd=root,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    url = 'http://127.0.0.1:8155/impulse-lab/'
fails = []
def check(c, m):
    if not c: fails.append(m); print('FAIL', m)
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp in [('desktop', {'width': 1280, 'height': 800}), ('phone', {'width': 390, 'height': 844})]:
        for theme in ('light', 'dark'):
            pg = b.new_page(viewport=vp, color_scheme=theme); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(url); pg.wait_for_timeout(600)
            for sc in ('draw', 'rain', 'ball', 'impact'):
                pg.evaluate(f"document.querySelector('#sceneSeg [data-v=\"{sc}\"]').click()"); pg.wait_for_timeout(250)
            # scenarios: steering wheel must exceed the force limit, airbag must stay below it
            res = {}
            for sc in ('wheel', 'airbag'):
                pg.evaluate(f"document.querySelector('[data-v=\"{sc}\"]').click()"); pg.wait_for_timeout(3500)
                res[sc] = pg.inner_text('#gchips')
            check('too high' in res['wheel'] or 'eccessiva' in res['wheel'], f'{name}/{theme}: wheel should exceed the limit')
            check('unharmed' in res['airbag'] or 'illeso' in res['airbag'], f'{name}/{theme}: airbag should be safe')
            # real data example
            pg.evaluate("[...document.querySelectorAll('button')].find(b=>/Esempio|Example/.test(b.textContent)).click()"); pg.wait_for_timeout(300)
            check('Dati' in pg.inner_text('#gchips') or 'Data' in pg.inner_text('#gchips'), f'{name}/{theme}: real data chip missing')
            # sketch prediction
            pg.evaluate("[...document.querySelectorAll('button')].find(b=>/Prevedi|Predict/.test(b.textContent)).click()"); pg.wait_for_timeout(200)
            bb = pg.query_selector('#g1').bounding_box()
            pg.mouse.move(bb['x'] + bb['width'] * .2, bb['y'] + bb['height'] * .8); pg.mouse.down()
            for i in range(25): pg.mouse.move(bb['x'] + bb['width'] * (.2 + .02 * i), bb['y'] + bb['height'] * (.8 - .5 * (1 - abs(i - 12) / 12)))
            pg.mouse.up()
            pg.evaluate("[...document.querySelectorAll('button')].find(b=>/Confronta|Compare/.test(b.textContent)).click()"); pg.wait_for_timeout(2500)
            check('Previsione' in pg.inner_text('#gchips') or 'Prediction' in pg.inner_text('#gchips'), f'{name}/{theme}: prediction result missing')
            check(not errs, f'{name}/{theme}: JS errors {errs}')
            pg.close()
    b.close()
if server: server.terminate()
print('SMOKE FAILED' if fails else 'smoke OK'); sys.exit(1 if fails else 0)
