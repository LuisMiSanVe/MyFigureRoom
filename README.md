> Languages: [🇺🇸 English](https://github.com/LuisMiSanVe/MyFigureRoom/blob/main/README.md) | [🇪🇸 Spanish](https://github.com/LuisMiSanVe/MyFigureRoom/blob/main/README.es.md) | [🇯🇵 Japanese](https://github.com/LuisMiSanVe/MyFigureRoom/blob/main/README.jp.md)
# 🏠 MyFigureRoom
[![VisualStudioCode](https://img.shields.io/badge/Visual_Studio_Code-0078D4?style=for-the-badge&logo=visual%20studio%20code&logoColor=white)](https://code.visualstudio.com/)
[![JavaScript](https://img.shields.io/badge/javascript-%23ff8040.svg?style=for-the-badge&logo=JavaScript&logoColor=ffffff)](https://developer.mozilla.org/docs/Web/JavaScript)
[![FFmpeg](https://img.shields.io/badge/FFMPEG-%233e9242.svg?style=for-the-badge&logo=FFmpeg&logoColor=ffffff)](https://www.ffmpeg.org/)
[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org/)

Web local virtual collectionist room that connects to your `MyFigureCollection` account and lets you display your figures and other merch.

## 📝 Technology Explanation
The website connects to your MyFigureCollection using the [unofficial API](https://github.com/ssskay/myfigurecollection-api) to get your owned, ordered and wishlisted figures and other merch.

That data must be set in public in your account's configuration in order to be reached by the API.

The connection does not need any of your credentials, just your username.

By default, it applies an algorithm to remove the background of the image, it may display weird looking results.

## 📋 Prerequisites
In order to deploy the server that hosts your webpage, you'll need to have [Python](https://www.python.org/) installed.

## 🛠️ Setup
Once `Python` is installed, install the `MyFigureCollection API` package:
```
pip install -r requirements.txt
```
Start the `server.py` with the following command:
```
python server.py
```

Then enter [localhost:3000](http://localhost:3000/) in your prefered browser to visit the page.

> [!IMPORTANT]
> The server hosts the website on the port `3000` by default, if you have another service using that port, change it on the script.

## 📖 About the Project
The room has different parts, each one displays the data got in MyFigureCollection differently:
- Bedroom:
  - Bed: Dream about your wishlist.
  - Desktop PC:
    - Check your on-going orders and link them to their actual tracking codes.
    - Check your MyFigureCollection's linked user or use a sample user to test the web's functions.
    - Export and Import your configuration to another device.
- Shelfs: Take your figures and other merch of your collection box and place them in the shelfs, you can change their sizes and add more shelfs if neccessary.
- Poster wall: Pin your posters and decor your empty wall.

## 📂 Files
The user's data is stored in the browser's cache files.

The displayed images are stored in the hidden folder `.img-cache` on the same folder of `server.py`.

In order to delete the data, erase the cache of the web.

Use the room's Desktop PC to export and import the data to other devices.

## 💻 Technologies Used
- Programming Language: [JavaScript](https://developer.mozilla.org/docs/Web/JavaScript), [Python](https://www.python.org/)
- Libraries: [myfigurecollection-api](https://github.com/ssskay/myfigurecollection-api)
- Recommended IDE: [VS Code](https://code.visualstudio.com/)
