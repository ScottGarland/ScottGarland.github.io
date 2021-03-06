var canvas = document.getElementById('canvas1');
var ctx = canvas.getContext('2d');

var canvas = document.getElementById('canvas2');
var ctx2 = canvas.getContext('2d');

var sphere = document.createElement('img');
sphere.src = "../img/sphere.png"; //default image

var color = document.getElementById('color'); //the color the user selects in dropdown menu
var startButton = document.getElementById('start');
var randomButton = document.getElementById('random');
var resetButton = document.getElementById('reset');
var pauseButton = document.getElementById('pause');
var dwnldButton = document.getElementById('download');
var text = document.getElementById('pause');
var planetSelect = document.getElementById('planet');
pauseButton.disabled = true; //disables pause button until start is pressed
pauseButton.style.opacity = 0.5;

var method; //simulation method to use

var w = canvas.width;
var h = canvas.height;

//put the origin (0,0) in the center of both canvases
ctx.translate(w/2, h/2);
ctx2.translate(w/2, h/2);

// Declaring variables and defualt values for the parameters of the double pendulum
// Fixed reference point is the 2D origin (0,0)
var m1 = parseFloat(document.getElementById('m1').value);
var m2 = parseFloat(document.getElementById('m2').value);
var r1 = parseFloat(document.getElementById('r1').value);
var r2 = parseFloat(document.getElementById('r2').value);
var ang1 = parseFloat(document.getElementById('ang1').value) * (Math.PI)/180;
var ang2 = parseFloat(document.getElementById('ang2').value) * (Math.PI)/180;
var x1; // x co-ordinate of m1
var y1; // y co-ordinate of m1
var x2; // x co-ordinate of m2
var y2; // y co-ordinate of m2
var w1 = 0; // angular velocity of m1
var w2 = 0; // angular velocity of m2
var acc1; // angluar acceleration of m1
var acc2; // angluar acceleration of m2
var g = planetChoice(); // gravitational constant (scaled to 60 fps)

var lineColor;
var shadowColor;

//used to reset last values to nothing when start is pressed
var initialLastX;
var initialLastY;

//holds last position of pendulum
var lastX = initialLastX;
var lastY = initialLastY;

var animation;
var startTime = new Date();
var previousTime = startTime;

//first row of csv
let csvContent = "data:text/csv;charset=utf-8," + "Time (s), Angle 1 (deg), Angle 2 (deg)\n";

//when the images are loaded, the buttons will work.  Prevents image flickering at the beginning
sphere.onload = function(){
  // event listeners for buttons
  startButton.addEventListener('click', setup);

  randomButton.addEventListener('click', randomSetup);
}

resetButton.addEventListener('click', ()=>{
  location.reload();
});

pauseButton.addEventListener('click', (e)=>{
  e.preventDefault();

  if(text.innerHTML == 'Pause'){
    cancelAnimationFrame(animation);
    text.innerHTML = 'Resume';
    text.className= "btnText";
    dwnldButton.disabled = false;
    dwnldButton.style.opacity = 1;
  }
  else{
    update();
    text.innerHTML = 'Pause';
    text.className= "btnText";
    dwnldButton.disabled = true;
    dwnldButton.style.opacity = 0.5; //disable download when simulation running
  }
});

dwnldButton.addEventListener('click', (e)=>{
  e.preventDefault();
  //download data from csvContent
  var encodedUri = encodeURI(csvContent);
  var link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "Pendulum data.csv");
  link.click();
});

//validate the form------------------------------------------------------------------------------------------
function validateForm(){
  var inputs = document.forms["valueForm"].elements['input'];
  var valid;

  //Changes all border clors to black in case the form was validated multiple times
  for(i = 0; i < inputs.length; i++ ){
    inputs[i].style.border = '1.5px solid #282828';
  }

  //check if any field is blank
  for(i = 0; i < inputs.length; i++ ){
    if(inputs[i].value == ''){
      inputs[i].style.border = '1.5px solid #cc0000'; //changes wrong input border to red
      valid = false;
    }
  }

  if(valid == false){
    alert("Please fill out all required fields");
    return false;
  }
  //check if any input except angles are negative
  for(i = 0; i < inputs.length; i++ ){
    if(inputs[i].getAttribute('id') != 'ang1' && inputs[i].getAttribute('id') != 'ang2' ){
      if(inputs[i].value < 0){
        inputs[i].style.border = '1.5px solid #cc0000'; //changes wrong input border to red
        valid = false;
      }
    }
  }

  if(valid == false){
    alert("Please ensure that your inputs are valid numbers");
    return false;
  }
  return true;
}

//sets up the canvas for a new drawing
function setup(e){
  e.preventDefault();
  var valid = validateForm();
  if(!valid){return;}

  cancelAnimationFrame(animation);
  text.innerHTML = 'Pause';
  text.className = "btnText";
  pauseButton.disabled = false;
  pauseButton.style.opacity = 1;
  dwnldButton.disabled = true;
  dwnldButton.style.opacity = 0.5; //make it look disabled

  loadSphere();
  resetValues();
  drawBackground();
  setColor();
  update();
}

//sets up the canvas for a random drawing
function randomSetup(e){
  e.preventDefault();
  cancelAnimationFrame(animation);
  text.innerHTML = 'Pause';
  text.className = "btnText";
  pauseButton.disabled = false;
  pauseButton.style.opacity = 1;
  dwnldButton.disabled = true;
  dwnldButton.style.opacity = 0.5;

  var inputs = document.forms["valueForm"].elements['input'];
  //Changes all border clors to black in case the form was validated before hitting random button
  //(random setup does not need its own validation)
  for(i = 0; i < inputs.length; i++ ){
    inputs[i].style.border = '1.5px solid #282828';
  }

  setRandomValues();
  loadSphere();
  drawBackground();
  setColor();
  update();
}

function update(){
  if(method == 'euler'){calculate();}
  else if(method == 'rk4'){rk4();}
  ctx.clearRect(0 - w/2, 0 - h/2, w, h);
  drawLines();
  drawSphere(x1, y1);
  drawSphere(x2, y2);

  if (document.getElementById('traceSwitch').checked) {
    drawTrace();
  }

  setLast();
  animation = requestAnimationFrame(update);
}

// Calculations---------------------------------------------------------------------------------------
function calculate(){

  //each equation is split up into terms
  var num1 = -g * (2 * m1 + m2) * Math.sin(ang1);
  var num2 = -m2 * g * Math.sin(ang1-2*ang2);
  var num3 = -2*Math.sin(ang1-ang2)*m2;
  var num4 = w2*w2*r2+w1*w1*r1*Math.cos(ang1-ang2);
  var den = r1 * (2*m1+m2-m2*Math.cos(2*ang1-2*ang2)); //denominator
  acc1 = (num1 + num2 + num3*num4) / den;

  num1 = 2 * Math.sin(ang1-ang2);
  num2 = (w1*w1*r1*(m1+m2));
  num3 = g * (m1 + m2) * Math.cos(ang1);
  num4 = w2*w2*r2*m2*Math.cos(ang1-ang2);
  den = r2 * (2*m1+m2-m2*Math.cos(2*ang1-2*ang2)); //denominator
  acc2 = (num1*(num2+num3+num4)) / den;

  //get position based on angle
  x1 = r1 * Math.sin(ang1);
  y1 = (-r1 * Math.cos(ang1));
  x2 = x1 + r2 * Math.sin(ang2);
  y2 = (y1 - r2 * Math.cos(ang2));

  //reverse the y-coordinates so that the pendulum is drawn in the right place
  y1 *= -1;
  y2 *= -1;

  //multiply by 100 to scale the position in meters to pixels for aesthetics
  x1 *= 100;
  y1 *= 100;
  x2 *= 100;
  y2 *= 100;

  //find new velocity and angle based on acc calculated
  w1 += acc1;
  w2 += acc2;
  ang1 += w1;
  ang2 += w2;

  submitData();

}

//Fourth Order Runge-Kutta Method for approximating the next iteration---------------------------------------------------------------
function rk4() {

  let w1Temp = w1, w2Temp = w2, ang1Temp = ang1, ang2Temp = ang2; // for k4, j4
  let w1TempHalf1 = w1, w2TempHalf1 = w2, ang1TempHalf1 = ang1, ang2TempHalf1 = ang2; // for k2, j2
  let w1TempHalf2 = w1, w2TempHalf2 = w2, ang1TempHalf2 = ang1, ang2TempHalf2 = ang2; // for k3, j3

  // next iteration for w1------------------------------------------
  var num11 = -g * (2 * m1 + m2) * Math.sin(ang1);
  var num12 = -m2 * g * Math.sin(ang1-2*ang2);
  var num13 = -2*Math.sin(ang1-ang2)*m2;
  var num14 = w2*w2*r2+w1*w1*r1*Math.cos(ang1-ang2);
  var den11 = r1 * (2*m1+m2-m2*Math.cos(2*ang1-2*ang2));

  var k1 = (num11 + num12 + num13 * num14) / den11;

  // next iteration for w2------------------------------------------
  var num15 = 2 * Math.sin(ang1-ang2);
  var num16 = (w1*w1*r1*(m1+m2));
  var num17 = g * (m1 + m2) * Math.cos(ang1);
  var num18 = w2*w2*r2*m2*Math.cos(ang1-ang2);
  var den12 = r2 * (2*m1+m2-m2*Math.cos(2*ang1-2*ang2));

  var j1 = (num15 * (num16 + num17 + num18)) / den12;

  // calculating values at t + h/2
  // for k2, j2-----------------------------------------------------
  w1TempHalf1 += 0.5*k1;
  w2TempHalf1 += 0.5*j1;
  ang1TempHalf1 += 0.5*w1TempHalf1;
  ang2TempHalf1 += 0.5*w2TempHalf1;

  var num21 = -g * (2 * m1 + m2) * Math.sin(ang1TempHalf1);
  var num22 = -m2 * g * Math.sin(ang1TempHalf1-2*ang2TempHalf1);
  var num23 = -2*Math.sin(ang1TempHalf1-ang2TempHalf1)*m2;
  var num24 = w2TempHalf1*w2TempHalf1*r2+(w1 + k1/2)*(w1 + k1/2)*r1*Math.cos(ang1TempHalf1-ang2TempHalf1);
  var den21 = r1 * (2*m1+m2-m2*Math.cos(2*ang1TempHalf1-2*ang2TempHalf1));

  var k2 = (num21 + num22 + num23 * num24) / den21;

  var num25 = 2 * Math.sin(ang1TempHalf1-ang2TempHalf1);
  var num26 = (w1TempHalf1*w1TempHalf1*r1*(m1+m2));
  var num27 = g * (m1 + m2) * Math.cos(ang1TempHalf1);
  var num28 = (w2 + j1/2)*(w2 + j1/2)*r2*m2*Math.cos(ang1TempHalf1-ang2TempHalf1);
  var den22 = r2 * (2*m1+m2-m2*Math.cos(2*ang1TempHalf1-2*ang2TempHalf1));

  var j2 = (num25 * (num26 + num27 + num28)) / den22;

  // calculating values at t + h/2
  // for k3, j3-----------------------------------------------------
  w1TempHalf2 += 0.5*k1;
  w2TempHalf2 += 0.5*j1;
  ang1TempHalf2 += 0.5*w1TempHalf2;
  ang2TempHalf2 += 0.5*w2TempHalf2;

  var num31 = -g * (2 * m1 + m2) * Math.sin(ang1TempHalf2);
  var num32 = -m2 * g * Math.sin(ang1TempHalf2-2*ang2TempHalf2);
  var num33 = -2*Math.sin(ang1TempHalf2-ang2TempHalf2)*m2;
  var num34 = w2TempHalf2*w2TempHalf2*r2+(w1 + k2/2)*(w1 + k2/2)*r1*Math.cos(ang1TempHalf2-ang2TempHalf2);
  var den31 = r1 * (2*m1+m2-m2*Math.cos(2*ang1TempHalf2-2*ang2TempHalf2));

  var k3 = (num31 + num32 + num33 * num34) / den31;

  var num35 = 2 * Math.sin(ang1TempHalf2-ang2TempHalf2);
  var num36 = (w1TempHalf2*w1TempHalf2*r1*(m1+m2));
  var num37 = g * (m1 + m2) * Math.cos(ang1TempHalf2);
  var num38 = (w2 + j2/2)*(w2 + j2/2)*r2*m2*Math.cos(ang1TempHalf2-ang2TempHalf2);
  var den33 = r2 * (2*m1+m2-m2*Math.cos(2*ang1TempHalf2-2*ang2TempHalf2));

  var j3 = (num35 * (num36 + num37 + num38)) / den33;

  // calculating values for the next theoretical iteration if rk4 weren't used.
  // This is for the last k4 and j4. Evaluated at time t + h ----------------------------------
  w1Temp += k1;
  w2Temp += j1;
  ang1Temp += w1Temp;
  ang2Temp += w2Temp;

  var num41 = -g * (2 * m1 + m2) * Math.sin(ang1Temp);
  var num42 = -m2 * g * Math.sin(ang1Temp-2*ang2Temp);
  var num43 = -2*Math.sin(ang1Temp-ang2Temp)*m2;
  var num44 = w2Temp*w2Temp*r2+(w1Temp + k3)*(w1Temp + k3)*r1*Math.cos(ang1Temp-ang2Temp);
  var den41 = r1 * (2*m1+m2-m2*Math.cos(2*ang1Temp-2*ang2Temp));
  var k4 = (num41 + num42 + num43 * num44) / den41;

  var num45 = 2 * Math.sin(ang1Temp-ang2Temp);
  var num46 = (w1Temp*w1Temp*r1*(m1+m2));
  var num47 = g * (m1 + m2) * Math.cos(ang1Temp);
  var num48 = (w2Temp + j3)*(w2Temp + j3)*r2*m2*Math.cos(ang1Temp-ang2Temp);
  var den42 = r2 * (2*m1+m2-m2*Math.cos(2*ang1Temp-2*ang2Temp));
  var j4 = (num45 * (num46 + num47 + num48)) / den42;

  //get position based on angle
  x1 = r1 * Math.sin(ang1);
  y1 = (-r1 * Math.cos(ang1));
  x2 = x1 + r2 * Math.sin(ang2);
  y2 = (y1 - r2 * Math.cos(ang2));

  //reverse the y-coordinates so that the pendulum is drawn in the right place
  y1 *= -1;
  y2 *= -1;

  //multiply by 100 to scale the position in meters to pixels for aesthetics
  x1 *= 100;
  y1 *= 100;
  x2 *= 100;
  y2 *= 100;

  w1 += (1 / 6) * (k1 + 2*k2 + 2*k3 + k4);
  w2 += (1 / 6) * (j1 + 2*j2 + 2*j3 + j4);
  ang1 += w1;
  ang2 += w2;

  submitData();

}

//resusable function for each iteration method to allow data to be submitted to csv file
function submitData() {
  //***calculate time elapsed***
  var endTime = new Date();
  //get the total time the sim has been running
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  timeDiff /= 1000;

  //every 0.1 second, submit data to csv file;
  if((endTime - previousTime) >= 100){
    // get # seconds rounded down to 1 decimal place
    var seconds = (Math.floor(timeDiff * 10)) /10;

    var degAng1 = ang1 * (180 / Math.PI);
    var degAng2 = ang2 * (180 / Math.PI);

    //how many full rotations the pendulum has done
    var rotations1 = Math.abs(Math.floor(degAng1 / 360));
    var rotations2 = Math.abs(Math.floor(degAng2 / 360));

    //make sure the angles are between 0 and 360 deg by adding or subtracting rotations
    if(degAng1 > 360){degAng1 -= rotations1 * 360;}
    if(degAng1 < 0){degAng1 += rotations1 * 360;}
    if(degAng2 > 360){degAng2 -= rotations2 * 360;}
    if(degAng2 < 0){degAng2 += rotations2 * 360;}

    addData(seconds, degAng1.toFixed(2), degAng2.toFixed(2)); //add data to csv string

    previousTime = endTime;
  }
}

//add data to csv file--------------------------------------------------------------------------------------------------
function addData(time, ang1, ang2){
  csvContent += time + "," + ang1 + "," + ang2 + "\n";
}

// selects the appropriate gravitational acceleration based on user planet selection-----------------------------------------------
//all accel divided by 60*60 because the sim runs ~60fps and accel is m/s^2
//this means that 1 real second is 60 animation seconds, so accel must be scaled 60x slower
function planetChoice() {

  // indeces for planets in order: 0 = Mercury ... 7 = Neptune
  if (planetSelect.selectedIndex == 0){
    g = parseFloat(document.getElementById('mercury').value) / 3600;
    return g;
  }
  else if (planetSelect.selectedIndex == 1){
    g = parseFloat(document.getElementById('venus').value) / 3600;
    return g;
  }
  else if (planetSelect.selectedIndex == 2){
    g = parseFloat(document.getElementById('earth').value) / 3600;
    return g;
  }
  else if (planetSelect.selectedIndex == 3) {
    g = parseFloat(document.getElementById('mars').value) / 3600;
    return g;
  }
  else if (planetSelect.selectedIndex == 4){
    g = parseFloat(document.getElementById('jupiter').value) / 3600;
    return g;
  }

  else if (planetSelect.selectedIndex == 5){
    g = parseFloat(document.getElementById('saturn').value) / 3600;
    return g;
  }
  else if (planetSelect.selectedIndex == 6){
    g = parseFloat(document.getElementById('uranus').value) / 3600;
    return g;
  }
  else if (planetSelect.selectedIndex == 7){
    g = parseFloat(document.getElementById('neptune').value) / 3600;
    return g;
  }
  else if (planetSelect.selectedIndex == 8){
      g = parseFloat(document.getElementById('moon').value) / 3600;
      return g;
  }
}

//sets random inputs------------------------------------------------------------------------------------------------------------------
function setRandomValues(){
  m1 = Math.random()*4 + 4;
  m2 = Math.random()*4 + 4;
  r1 = Math.random() + 1;
  r2 = Math.random() + 1;
  ang1 = Math.random()*6.3;
  ang2 = Math.random()*6.3;
  x1;
  y1;
  x2;
  y2;
  w1 = 0;
  w2 = 0;
  acc1;
  acc2;
  g = planetChoice();
  lastX = initialLastX;
  lastY = initialLastY;
  csvContent = "data:text/csv;charset=utf-8," + "Time (s), Angle 1 (deg), Angle 2 (deg)\n";
  startTime = new Date();
  previousTime = startTime;
  method = document.getElementById('iteration').value;

  // displaying the random value to 2 decimal places into the html form
  document.getElementById('m1').value = m1.toFixed(2);
  document.getElementById('m2').value = m2.toFixed(2);
  document.getElementById('r1').value = r1.toFixed(2);
  document.getElementById('r2').value = r2.toFixed(2);
  document.getElementById('ang1').value = (ang1 * 180/(Math.PI)).toFixed(2);
  document.getElementById('ang2').value = (ang2 * 180/(Math.PI)).toFixed(2);

  var degAng1 = ang1 * (180 / Math.PI);
  var degAng2 = ang2 * (180 / Math.PI);

  //make sure the angles are between 0 and 360 deg;
  if(degAng1 > 360){degAng1 -= 360;}
  if(degAng1 < 0){degAng1 += 360;}
  if(degAng2 > 360){degAng2 -= 360;}
  if(degAng2 < 0){degAng2 += 360;}
  //add initial data to csv file
  addData(0, degAng1.toFixed(2), degAng2.toFixed(2));
}

//load correct sphere images based on user choice--------------------------------------------------------------------------------
function loadSphere(){

  var name = color.value; //from user input

  switch(name){
    case "red":
      sphere.src = "../img/sphere red.png";
      break;
    case "orange":
      sphere.src = "../img/sphere orange.png";
      break;
    case "yellow":
      sphere.src = "../img/sphere yellow.png";
      break;
    case "blue":
      sphere.src = "../img/sphere.png";
      break;
    case "green":
      sphere.src = "../img/sphere green.png";
      break;
    case "violet":
      sphere.src = "../img/sphere purple.png";
      break;
    case "pink":
      sphere.src = "../img/sphere pink.png";
      break;
  }
}

//sets background to black------------------------------------------------------------------------------------------------
function drawBackground(){
  canvas2.style.background = 'none';
  ctx2.fillStyle = 'black';
  ctx2.fillRect(0 - w/2, 0 - h/2, w, h) //since translate puts 0,0 in the middle of the canvas
}

//draws a sphere---------------------------------------------------------------------------------------------------------------
function drawSphere(x, y){
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, 6.28, false); //(xpos, ypos, rad, start angle, end angle, clockwise)
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(sphere, x -25, y-25, 50, 50); //draws image at center of clipped circle
    ctx.restore();
}

//draws the ropes---------------------------------------------------------------------------------------------------------------------
function drawLines(){
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.closePath();
}

//keeps track of last position of pendulum 2--------------------------------------------------------------------------------------
function setLast(){
  lastX = x2;
  lastY = y2;
}

//traces pendulum 2-----------------------------------------------------------------------------------------------------------------
function drawTrace(){

  ctx2.beginPath();
  ctx2.moveTo(lastX, lastY);
  ctx2.lineTo(x2, y2);
  ctx2.strokeStyle = lineColor;
  ctx2.shadowColor = shadowColor;
  ctx2.shadowBlur = 10;
  ctx2.lineWidth = 2.5;
  ctx.lineJoin = 'round'; //make edges smooth
  ctx2.lineCap = 'round';
  ctx2.stroke();
  ctx2.closePath();
}

//sets the color of the trace----------------------------------------------------------------------------------------------------
function setColor(){
  var traceColors = new Array();
  //[] = 'stroke, shadow color'
  traceColors["red"] = '#ff9999 #ff0000'
  traceColors["orange"] = '#ffb380 #e65c00'
  traceColors["yellow"] = '#ffff99 #ffff4d'
  traceColors["blue"] = '#b3ffff #00e6e6'
  traceColors["green"] = '#adebad #00e600'
  traceColors["violet"] = '#ecb3ff #ac00e6'
  traceColors["pink"] = '#ffb3d9 #ff0080'

  var codes = traceColors[color.value];
  lineColor = codes.slice(0, 7); //first # value
  shadowColor = codes.slice(8, 15); //second # value
}

//resets values for new drawing-------------------------------------------------------------------------------------------------------
function resetValues(){

  m1 = parseFloat(document.getElementById('m1').value);
  m2 = parseFloat(document.getElementById('m2').value);
  r1 = parseFloat(document.getElementById('r1').value);
  r2 = parseFloat(document.getElementById('r2').value);
  ang1 = parseFloat(document.getElementById('ang1').value) * (Math.PI)/180;
  ang2 = parseFloat(document.getElementById('ang2').value) * (Math.PI)/180;
  x1;
  y1;
  x2;
  y2;
  w1 = 0;
  w2 = 0;
  acc1;
  acc2;
  g = planetChoice();
  lastX = initialLastX;
  lastY = initialLastY;
  csvContent = "data:text/csv;charset=utf-8," + "Time (s), Angle 1 (deg), Angle 2 (deg)\n";
  startTime = new Date();
  previousTime = startTime;
  method = document.getElementById('iteration').value;

  var degAng1 = ang1 * (180 / Math.PI);
  var degAng2 = ang2 * (180 / Math.PI);

  //make sure the angles are between 0 and 360 deg;
  if(degAng1 > 360){degAng1 -= 360;}
  if(degAng1 < 0){degAng1 += 360;}
  if(degAng2 > 360){degAng2 -= 360;}
  if(degAng2 < 0){degAng2 += 360;}
  addData(0, degAng1.toFixed(2), degAng2.toFixed(2));
}
