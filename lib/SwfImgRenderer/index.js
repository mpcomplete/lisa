'use strict';

var zlib      = require('zlib');
var PngWriter = require('./PngWriter');

function SwfImgRenderer() {}
module.exports = SwfImgRenderer;

SwfImgRenderer.prototype.render = function (swfObject, whenDone) {
	if (swfObject.colorData) {
		this._renderPng(swfObject, whenDone);
	} else {
		this._renderJpg(swfObject, whenDone);
	}
};

SwfImgRenderer.prototype._renderPng = function (swfObject, whenDone) {
	if (!swfObject.colorData) {
		// Should never happen unless caller is wrong
		throw new Error('Invalid data for PNG file');
	}
	var self = this;
	this._inflate(swfObject.colorData, function (buffer) {
		swfObject.data = buffer;
		self._translatePng(swfObject, whenDone);
	});
};

SwfImgRenderer.prototype._renderJpg = function (swfObject, whenDone) {
	var self = this;
	if (swfObject.alphaData) {
		this._inflate(swfObject.alphaData, function (buffer) {
			swfObject.inflatedAlphaData = buffer;
			self._translateJpg(swfObject, whenDone);
		});
	} else {
		self._translateJpg(swfObject, whenDone);
	}
};

SwfImgRenderer.prototype._inflate = function (strdata, onData) {
	var data = new Buffer(strdata);
	zlib.inflate(data, function (error, buffer) {
		if (error) throw new Error('Invalid compressed data. ' + error);
		onData(buffer);
	});
};

SwfImgRenderer.prototype._translatePng = function (swfObject, whenDone) {
	var imgData   = this._translateSwfPngToPng(swfObject);
	var pngWriter = new PngWriter(swfObject.width, swfObject.height, true, swfObject.colorTableSize, false);

	if (swfObject.colorTableSize) pngWriter.addPalette(swfObject.data);

	pngWriter.addData(imgData, imgData.length, function () {
		swfObject.pngContent = pngWriter.getFinalContent();
		whenDone(swfObject, swfObject.pngContent);
	});
};

SwfImgRenderer.prototype._translateSwfPngToPng = function (swfObject) {
	var width  = swfObject.width;
	var height = swfObject.height;

	var colorTableSize = swfObject.colorTableSize || 0;
	var withAlpha      = swfObject.withAlpha;
	var data           = swfObject.data;

	var pxIdx  = 0;
	var bpp    = 4;
	// var bpp = (withAlpha ? 4 : 3); <- used to be this, but doesn't seem to work
	var cmIdx  = colorTableSize * bpp;
	var pad    = colorTableSize ? ((width + 3) & ~3) - width : 0;
	var pxData = new Buffer(width * height * bpp + height); //+height for filter byte (1 per line)

	for (var j = 0; j < height; j += 1) {
		pxData[pxIdx++] = 0; // PNG filter-type
		for (var i = 0; i < width; i += 1) {
			var idx = (colorTableSize ? data[cmIdx] : cmIdx) * bpp;
			var alpha = withAlpha ? data[idx] : 255;
			var premultiplierInv = 255 / alpha;
			pxData[pxIdx]     = data[idx + 1] * premultiplierInv;
			pxData[pxIdx + 1] = data[idx + 2] * premultiplierInv;
			pxData[pxIdx + 2] = data[idx + 3] * premultiplierInv;
			pxData[pxIdx + 3] = alpha;
			
			cmIdx += 1;
			pxIdx += 4;
		}
		cmIdx += pad;
	}
	return pxData;
};
