const { readMrz, getMrz } = require('./');

const Image = require('image-js').Image;
const express = require('express');
const bodyparser = require('body-parser');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;
const router = express.Router();

const upload = multer({ limits: { fileSize: 32*1024*1024 } });

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

router.post('/upload', upload.single('image'), async function (req, res) {
    console.log('hit the /upload function');
    const sourceImage = await Image.load(req.file.buffer);
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
    return res.status(200).json({ mrz: result.mrz });
});

// 3 lines of 30 chars
// 0,0,1: I = ID
// 0,2,3: document issueing country?
// 0,5,9: document id number
// 0,14,9: BSN
// 1,0,6: DOB (2/2/2 rev)
// 1,6,1: gender
// 1,7,6: expire (2/2/2 rev)
// 1,13,1: ??? single digit
// 1,14,3: nationality? country of birth?
// 2,0: lastname<<first-names: remove trailing <, split on <<
//"I<NLDIVC1FLH162173016005<<<<<5",
//"7608162M2502209NLD<<<<<<<<<<<2",
//"GOUDSMIT<<GILION<RAMON<<<<<<<<"

app.listen(port, function () {
  console.log('Server is running on PORT',port);
});
