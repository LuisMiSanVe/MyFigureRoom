> Idiomas: [🇺🇸 Inglés](https://github.com/LuisMiSanVe/MyFigureRoom/blob/main/README.md) | [🇪🇸 Español](https://github.com/LuisMiSanVe/MyFigureRoom/blob/main/README.es.md) | [🇯🇵 Japonés](https://github.com/LuisMiSanVe/MyFigureRoom/blob/main/README.jp.md)
# 🏠 MyFigureRoom
[![VisualStudioCode](https://img.shields.io/badge/Visual_Studio_Code-0078D4?style=for-the-badge&logo=visual%20studio%20code&logoColor=white)](https://code.visualstudio.com/)
[![JavaScript](https://img.shields.io/badge/javascript-%23ff8040.svg?style=for-the-badge&logo=JavaScript&logoColor=ffffff)](https://developer.mozilla.org/docs/Web/JavaScript)
[![FFmpeg](https://img.shields.io/badge/FFMPEG-%233e9242.svg?style=for-the-badge&logo=FFmpeg&logoColor=ffffff)](https://www.ffmpeg.org/)
[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org/)

Web local de habitación virtual de un coleccionista que se conecta con tu cuenta de `MyFigureCollection` y te deja colocar tus figuras y otro merch.

## 📝 Explicación de Tecnología
La página se conecta a MyFigureCollection usando la [API no oficial](https://github.com/ssskay/myfigurecollection-api) para conseguir lo que tienes, lo que has pedido y lo que tienes en la lista de deseados.

Los datos deben estar en publicos en la configuracion de tu cuenta para que la API llegue a ellos.

La conexión no necesita ninguna de tus credenciales, solo tu nombre de usuario.

Por defecto, aplica un algoritmo que elimina el fondo de las imagenes, es posible que los resultados se vean raros.

## 📋 Prerequisitos
Para armar el servidor que publica tu página web, necesitas tener [Python](https://www.python.org/) instalado.

## 🛠️ Instalación
Una vez `Python` esté instalado, instala el paquete de la `API de MyFigureCollection`:
```
pip install -r requirements.txt
```
Inicia `server.py` con este comando:
```
python server.py
```

Entra a [localhost:3000](http://localhost:3000/) con tu navegador preferido para visitar la página.

> [!IMPORTANT]
> El servidor publica la página en el puerto `3000` por defecto, si tienes algun otro servicio usando ese puerto, cambialo desde el script.

## 📖 Sobre el proyecto
La habitación tiene diferentes partes, cada una muestra los datos de MyFigureCollection de forma diferente:
- Dormitorio:
  - Cama: Sueña sobre tu lista de deseados.
  - Ordenador de escritorio:
    - Revisa tus pedidos activos y vinculalos a sus códigos de seguimiento reales.
    - Revisa la información de tu usuario vinculado de MyFigureCollection o usa datos de prueba para probar las funciones de la web.
    - Exporta e importa tu configuracion a otro dispositivo.
- Estantería: Saca tus figuras y otro merch de tu caja de colección y ponlas en las baldas de la estantería, puedes cambiar su tamaño o añadir más baldas si es necesario.
- Pared para posters: Fija tus posters y más decoración en tu pared vacia.

## 📂 Archivos
Los datos del usuario se guardan en el cache del navegador.

Las imagenes que se muestran se guardan en la carpeta oculta `.img-cache` en la misma carpeta de `server.py`.

Para eliminar los datos, borra el cache de la web.

Usa el Ordenador de escritorio de la habitación para exportar e importar los datos a otro dispositivo.

## 💻 Tecnologías usadas
- Lenguaje de programación: [JavaScript](https://developer.mozilla.org/docs/Web/JavaScript), [Python](https://www.python.org/)
- Librerías: [myfigurecollection-api](https://github.com/ssskay/myfigurecollection-api)
- IDE Recomendado: [VS Code](https://code.visualstudio.com/)
