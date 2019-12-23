const { readMrz, getMrz } = require('./');

const Image = require('image-js').Image;
const express = require('express');
const bodyparser = require('body-parser');
const multer = require('multer');
const parse = require('mrz').parse;
const pdfjsLib = require('pdfjs-dist');

const app = express();
const port = process.env.PORT || 3000;
const router = express.Router();

const upload = multer({ limits: { fileSize: 32*1024*1024 } });

var Canvas = require('canvas');
var assert = require('assert');
function NodeCanvasFactory() {}
NodeCanvasFactory.prototype = {
  create: function NodeCanvasFactory_create(width, height) {
    assert(width > 0 && height > 0, 'Invalid canvas size');
    var canvas = Canvas.createCanvas(width, height);
    var context = canvas.getContext('2d');
    return {
      canvas: canvas,
      context: context,
    };
  },

  reset: function NodeCanvasFactory_reset(canvasAndContext, width, height) {
    assert(canvasAndContext.canvas, 'Canvas is not specified');
    assert(width > 0 && height > 0, 'Invalid canvas size');
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },

  destroy: function NodeCanvasFactory_destroy(canvasAndContext) {
    assert(canvasAndContext.canvas, 'Canvas is not specified');

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  },
};

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended: true}));

app.use('/', router);

router.get('/test', async function (req,res) {
    res.send(
`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>MZR OCR Test upload</title>
  </head>
  <body>
      <p>Image Upload</p>
      <form method="post" action="upload" enctype="multipart/form-data">
        <input type="file" name="image" /><br /><br />
        <button type="submit" name="upload">Upload</button>
      </form>
  </body>
</html>`
   );
});

// Reads the PDF in buffer and returns a rendered image
async function readPDF(buffer) {
    var pdfDocument = await pdfjsLib.getDocument(req.file.buffer).promise;    
    console.log('created pdf object from file buffer');
    var page = await pdfDocument.getPage(1);
    console.log('got page 1');
    var viewport = page.getViewport({ scale: 1.0});
    console.log('got viewport');
    var canvasFactory = new NodeCanvasFactory();
    var canvasAndContext = canvasFactory.create(viewport.width,viewport.height);
    console.log('setup canvas');
    var renderContext = {
        canvasContext: canvasAndContext.context,
        viewport: viewport,
        canvasFactory: canvasFactory,
    };
    await page.render(renderContext).promise;
    console.log('rendered page to image');
    const imageBuffer = canvasAndContext.canvas.toBuffer();
    console.log('converted image to buffer');
    const image = await Image.load(imageBuffer);
    return image;
}

router.post('/upload', upload.single('image'), async function (req, res) {
    var sourceImage;
    console.log('hit the /upload function');
    if(req.file) {
        console.log('form upload detected with file element name "image"');
        console.log(req.file);
        const mimetype = req.file.mimetype
        if(!mimetype) {
            console.log('Upload without mimetype detected');
            return res.status(500).send('Form upload element did not have mimetype');
        }
        if(mimetype == 'application/pdf') {
            console.log('mime type suggests pdf; converting buffer into image');
            sourceImage = readPDF(req.file.buffer);
        } else {
            console.log('read image directly from buffer');
            sourceImage = await Image.load(req.file.buffer);
        }
    } else {
        // should check the content-type header and load the image accordingly
        console.log('no file form element named "upload" detected; may want to read body directly');
        console.log(req);
        return res.status(500).send('No form element named "upload" detected');
    }
    console.log('loaded the image');
    const processedImage = {};
    try {
        await getMrz(sourceImage, { out:processedImage, debug:true });
    } catch(e) {
        console.error(e);
        // throw a nice error?
    }
    console.log('processed the image');
    // throw a nice error if no crop item?
    console.log(processedImage);
    const mrzImage = processedImage['crop'];      // this is the area containing the MRZ only
    if(!mrzImage) { res.status(500).send('No MRZ-area detected'); }
    console.log('got the cropped part');
    const result = await readMrz(mrzImage);           // does the OCR
    console.log('OCRd the MRZ');
    console.log(result);
    // throw a nice error if nothing read?
    console.log(result.mrz);
    var parsed = parse(result.mrz);
    console.log(parsed);
    // parsed.fields is the dictionary that is actually the content
    return res.status(200).json({ mrz: result.mrz, parsed: parsed });
});

app.listen(port, function () {
  console.log('Server is running on PORT',port);
});
