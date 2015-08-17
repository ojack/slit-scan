var WIDTH = 1000;
var HEIGHT = 500;
var STEP = 1;
var VID_STEP = 1;

class SlitScan {
	constructor(video){
		this.outIndex= 0;
		this.vidIndex = 0;
		this.video = video;
		var canvas = document.createElement('canvas');
		this.context = canvas.getContext('2d');
		canvas.height = 500;
		canvas.width = WIDTH;
		document.body.insertBefore(canvas, document.body.firstChild);
		console.log("created slit scan");
	}

	addFrame(){
	//console.log(this.video);
		//console.log(this.context);
		 this.context.drawImage(this.video, this.vidIndex, 0, STEP, HEIGHT, this.outIndex, 0, STEP, HEIGHT);
		 this.context.beginPath();
	      this.context.moveTo(100, 150);
	      this.context.lineTo(450, 50);
	      this.context.stroke();
	      this.outIndex += STEP;
	      this.vidIndex += VID_STEP;
	    //  console.log("vid index " + this.vidIndex + " out index " + this.outIndex);
	}
}

this.SlitScan = SlitScan;