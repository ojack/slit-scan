window.AudioContext = window.AudioContext||window.webkitAudioContext;

var HEIGHT = 400;
var WIDTH = 600;
class AudioProcessing {
  constructor(stream, context){
    // // Draw audio waveform
   
    //  var canvas = document.createElement('canvas');
    // this.drawContext = canvas.getContext('2d');
    // canvas.height = HEIGHT;
    // canvas.width = WIDTH;
    // document.body.insertBefore(canvas, document.body.firstChild);
    console.log(stream);
     var input = context.createMediaStreamSource(stream);
   

    var analyser = context.createAnalyser();

    // Connect graph.
    input.connect(analyser);
   

    this.analyser = analyser;
   
    this.visualize();
     console.log(context);
   
  }
  getVolume(){
        var freqDomain = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(freqDomain);
        var values = 0;
        var average;
 
        var length = freqDomain.length;
 
        // get all the frequency amplitudes
        for (var i = 0; i < length; i++) {
            values += freqDomain[i];
        }
 
        average = values / length;
        return average;
   
  }
  visualize(){
     console.log("visualizing");
      var freqDomain = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqDomain);
   // console.log(freqDomain);
  //  //draw viz
  //   this.drawContext.clearRect(0, 0, WIDTH, HEIGHT);
  //   for (var i = 0; i <freqDomain.length; i++) {
  // var value = freqDomain[i];
  // var percent = value / 256;
  // var height = HEIGHT * percent;
  // var offset = HEIGHT - height - 1;
  // var barWidth = WIDTH/freqDomain.length;
  // var hue = i/freqDomain.length * 360;
  // this.drawContext.fillStyle = 'hsl(' + hue + ', 100%, 50%)';
  // this.drawContext.fillRect(i * barWidth, offset, barWidth, height);
//}
   // console.log(freqDomain);
  // requestAnimationFrame(this.visualize.bind(this));
  }
}

export default AudioProcessing;