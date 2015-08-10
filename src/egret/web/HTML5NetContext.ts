//////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (c) 2014-2015, Egret Technology Inc.
//  All rights reserved.
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the Egret nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY EGRET AND CONTRIBUTORS "AS IS" AND ANY EXPRESS
//  OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
//  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
//  IN NO EVENT SHALL EGRET AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
//  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;LOSS OF USE, DATA,
//  OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
//  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
//  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
//  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
//////////////////////////////////////////////////////////////////////////////////////


module egret.web {
    /**
     * @class egret.HTML5NetContext
     * @classdesc
     * @extends egret.NetContext
     * @private
     */
    export class HTML5NetContext extends HashObject implements NetContext{

        /**
         * @private
         */
        public _versionCtr:egret.IVersionController;

        /**
         * @private
         */
        private _imageLoader:egret.ImageLoader;
        /**
         * @private
         */
        public constructor() {
            super();

            this._imageLoader = new egret.ImageLoader();
        }

        /**
         * @private
         * 
         * @param versionCtr 
         */
        public initVersion(versionCtr:egret.IVersionController):void {
            this._versionCtr = versionCtr;
        }

        /**
         * @private
         * 
         * @param loader 
         */
        public proceed(loader:URLLoader):void {
            var self = this;
            if (loader.dataFormat == URLLoaderDataFormat.TEXTURE) {
                this.loadTexture(loader);
                return;
            }
            if (loader.dataFormat == URLLoaderDataFormat.SOUND) {
                this.loadSound(loader);
                return;
            }

            var request:URLRequest = loader._request;
            var xhr = this.getXHR();
            xhr.onreadystatechange = onReadyStateChange;

            var virtualUrl:string = self.getVirtualUrl(egret.$getUrl(request));

            xhr.open(request.method, virtualUrl, true);
            this.setResponseType(xhr, loader.dataFormat);
            if (request.method == URLRequestMethod.GET || !request.data) {
                xhr.send();
            }
            else if (request.data instanceof URLVariables) {
                xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                var urlVars:URLVariables = <URLVariables> request.data;
                xhr.send(urlVars.toString());
            }
            else {
                xhr.setRequestHeader("Content-Type", "multipart/form-data");
                xhr.send(request.data);
            }


            function onReadyStateChange() {
                if (xhr.readyState == 4) {// 4 = "loaded"
                    if (xhr.status != loader._status) {
                        loader._status = xhr.status;
                        HTTPStatusEvent.dispatchHTTPStatusEvent(loader, xhr.status);
                    }

                    if (xhr.status >= 400 || xhr.status == 0) {//请求错误
                        IOErrorEvent.dispatchIOErrorEvent(loader);
                    }
                    else {
                        onLoadComplete();
                    }
                }
            }

            function onLoadComplete() {
                switch (loader.dataFormat) {
                    case URLLoaderDataFormat.TEXT:
                        loader.data = xhr.responseText;
                        break;

                    case URLLoaderDataFormat.VARIABLES:
                        loader.data = new URLVariables(xhr.responseText);
                        break;

                    case URLLoaderDataFormat.BINARY:
                        loader.data = xhr.response;
                        break;
                    default:
                        loader.data = xhr.responseText;
                        break;
                }
                $callAsync(Event.dispatchEvent, Event, loader, Event.COMPLETE);
            }
        }

        /**
         * @private
         * 
         * @param loader 
         */
        private loadSound(loader:URLLoader):void {
            var virtualUrl:string = this.getVirtualUrl(loader._request.url);
            var audio = new egret.Audio();
            audio.$loadByUrl(virtualUrl, function (code:number) {
                if (code != 0) {
                    IOErrorEvent.dispatchIOErrorEvent(loader);
                    return;
                }
                var sound = new Sound();
                sound.$setAudio(audio);
                loader.data = sound;
                $callAsync(Event.dispatchEvent, Event, loader, Event.COMPLETE);
            });
        }

        /**
         * @private
         * 
         * @returns 
         */
        private getXHR():any {
            if (window["XMLHttpRequest"]) {
                return new window["XMLHttpRequest"]();
            } else {
                return new ActiveXObject("MSXML2.XMLHTTP");
            }
        }

        /**
         * @private
         * 
         * @param xhr 
         * @param responseType 
         */
        private setResponseType(xhr:XMLHttpRequest, responseType:string):void {
            switch (responseType) {
                case URLLoaderDataFormat.TEXT:
                case URLLoaderDataFormat.VARIABLES:
                    xhr.responseType = URLLoaderDataFormat.TEXT;
                    break;

                case URLLoaderDataFormat.BINARY:
                    xhr.responseType = "arraybuffer";
                    break;

                default:
                    xhr.responseType = responseType;
                    break;
            }
        }

        /**
         * @private
         * 
         * @param loader 
         */
        private loadTexture(loader:URLLoader):void {
            var virtualUrl:string = this.getVirtualUrl(loader._request.url);
            if(Html5Capatibility._WebPSupport) {
                if(virtualUrl.indexOf(".png") != -1) {
                    virtualUrl = virtualUrl.replace(".png",".webp");
                }
                else if(virtualUrl.indexOf(".jpg") != -1) {
                    virtualUrl = virtualUrl.replace(".jpg",".webp");
                }
            }
            this._imageLoader.load(virtualUrl, function (code:number, bitmapData:HTMLImageElement) {
                if (code != 0) {
                    IOErrorEvent.dispatchIOErrorEvent(loader);
                    return;
                }
                var texture:Texture = new Texture();
                texture._setBitmapData(bitmapData);
                loader.data = texture;
                $callAsync(Event.dispatchEvent, Event, loader, Event.COMPLETE);
            })
        }

        /**
         * @private
         * 
         * @returns 
         */
        public getChangeList():Array<any> {
            return [];
        }

        /**
         * @private
         * 获取虚拟url
         * @param url
         * @returns {string}
         */
        private getVirtualUrl(url:string):string {
            if (this._versionCtr) {
                return this._versionCtr.getVirtualUrl(url);
            }
            return url;
        }

        static _instance:HTML5NetContext;
        static getNetContext():HTML5NetContext {
            if (HTML5NetContext._instance == null) {
                HTML5NetContext._instance = new HTML5NetContext();
            }
            return HTML5NetContext._instance;
        }
    }

    NetContext = HTML5NetContext;
}