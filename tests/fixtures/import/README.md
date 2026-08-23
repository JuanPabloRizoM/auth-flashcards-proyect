# Fixtures de importación

Archivos reales de cada formato soportado. Los tests los leen del disco: no se construyen
tablas a mano en el propio test, porque entonces solo se probaría el código contra sí mismo.

## Texto

Escritos directamente. `comillas.csv` es el caso que un `split(',')` rompería: comas y
comillas dentro de los campos y un campo con un salto de línea. `vacio.csv` mide 0 bytes.
`sin-tabla.md` es prosa: sirve para comprobar que no se interpreta como tarjetas.

## Hojas de cálculo

Generadas por dos escritores independientes, a propósito, porque un `.xlsx` puede guardar
su texto de dos maneras distintas y el lector tiene que aguantar las dos:

- **openpyxl** escribe cadenas en línea (`t="inlineStr"`) y rutas absolutas en las
  relaciones: `basico.xlsx` y `multihoja.xlsx`.
- **XlsxWriter** escribe una tabla de cadenas compartidas (`t="s"`) y rutas relativas:
  `compartidas.xlsx`.

`roto.xlsx` son los primeros 300 bytes de `basico.xlsx`: parece un `.xlsx` por el nombre,
pero no es un ZIP válido.

Para regenerarlas hace falta Python con `openpyxl` y `xlsxwriter`, que NO son dependencias
del proyecto. Fuera del repositorio:

```bash
python3 -m venv /tmp/fixtures-venv
/tmp/fixtures-venv/bin/pip install openpyxl xlsxwriter
/tmp/fixtures-venv/bin/python tests/fixtures/import/generar_xlsx.py tests/fixtures/import
head -c 300 tests/fixtures/import/basico.xlsx > tests/fixtures/import/roto.xlsx
```
