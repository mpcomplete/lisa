APPDATA = \
	components/ \
	images/ \
	node_modules/ \
	lib/ \
	package.json

# No need to ship these nwjs files. They're just dead weight.
NWJS_NOSHIP = \
	d3dcompiler_47.dll \
	ffmpegsumo.dll \
	nwjc.exe \
	nwjc \
	pdf.dll

VERSION = $(shell cat ../LATEST)

MACDIR=Lisa/nwjs.app/Contents/Resources/app.nw
PLISTDIR=Lisa/nwjs.app/Contents
WINDIR=Lisa

DEPS = $(APPDATA:%=../%)
DEPS := $(DEPS) $(foreach dir, $(DEPS), $(wildcard $(dir)/*))

all: Lisa-appdata.zip Lisa-win64.zip Lisa-win32.zip Lisa-mac64.zip Lisa-mac32.zip

Lisa-appdata.zip: $(DEPS)
	rm -rf Lisa $@
	mkdir -p Lisa
	cd ../ && cp -a $(APPDATA) dist/Lisa
	find Lisa -name '*.sw[a-z]' -exec rm \{\} \;
	cd Lisa && \
	  cat package.json | sed -e 's/"toolbar": true/"toolbar": false/' > package.json && \
	  zip -q -r ../Lisa-appdata.zip .
	rm -rf Lisa

Lisa-%.zip: nwjs-%.zip Lisa-appdata.zip
	rm -rf Lisa nwjs-v* $@
	unzip -q $< && mv nwjs-v* Lisa
	cd Lisa && rm -f $(NWJS_NOSHIP)
	if [ -d Lisa/nwjs.app ]; then \
	  unzip -q Lisa-appdata.zip -d $(MACDIR); \
	  sed -e 's/{{VERSION}}/$(VERSION)/g' Info.plist > $(PLISTDIR)/Info.plist; \
	else \
	  unzip -q Lisa-appdata.zip -d $(WINDIR); \
	fi
	zip -q -r $@ Lisa


URLBASE = http://dl.nwjs.io/v0.12.1/nwjs-v0.12.1-
nwjs-win64.zip:
	curl -o nwjs-win64.zip $(URLBASE)win-x64.zip

nwjs-win32.zip:
	curl -o nwjs-win32.zip $(URLBASE)win-ia32.zip

nwjs-mac64.zip:
	curl -o nwjs-mac64.zip $(URLBASE)osx-x64.zip

nwjs-mac32.zip:
	curl -o nwjs-mac32.zip $(URLBASE)osx-ia32.zip
