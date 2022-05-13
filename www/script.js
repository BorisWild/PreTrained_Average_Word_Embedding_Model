import * as DICTIONARY from './model/dictionary.js';
//import { io } from "./socket.io.esm.min.js";

const POST_COMMENT_BTN = document.getElementById('post');
const COMMENT_TEXT = document.getElementById('comment');
const COMMENTS_LIST = document.getElementById('commentsList');
// CSS styling class to indicate comment is being processed when
// posting to provide visual feedback to users.
const PROCESSING_CLASS = 'processing';

// Store username of logged in user. Right now we have no auth
// so default to Anonymous until known.
var currentUserName = 'Anonymous';

POST_COMMENT_BTN.addEventListener('click', handleCommentPost);

// Set the URL below to the path of the model.json file we uploaded.
const MODEL_JSON_URL = './model/model.json';
// Set the minimum confidence for spam comments to be flagged.
// Remember this is a number from 0 to 1, representing a percentage
// So here 0.75 == 75% sure it is spam.
const SPAM_THRESHOLD = 0.4;

// Create a variable to store the loaded model once it is ready so we
// can use it elsewhere in our program later.
var model = undefined;
// The number of input elements our ML Model is expecting.
const ENCODING_LENGTH = 20;

/**
 * Function that takes an array of words, converts words to tokens,
 * and then returns a Tensor representation of the tokenization that
 * can be used as input to the machine learning model.
 */
function tokenize(wordArray) {
    // Always start with the START token.
    let returnArray = [DICTIONARY.START];

    // Loop through the words in the sentence we want to encode.
    // If word is found in dictionary, add that number else
    // we add the UNKNOWN token.
    for (var i = 0; i < wordArray.length; i++) {
        let encoding = DICTIONARY.LOOKUP[wordArray[i]];
        returnArray.push(encoding === undefined ? DICTIONARY.UNKNOWN : encoding);
    }
    // You can then add another loop to ensure padding is added in case
    // the sentence was less than 19 words. Keep adding the padding
    // token while the ‘returnArray’ length is less than the desired
    // ‘ENCODING_LENGTH’.
    while (returnArray.length < ENCODING_LENGTH) {
        returnArray.push(DICTIONARY.PAD);
    }
    console.log(returnArray);

    // Convert to a TensorFlow Tensor and return that.
    return tf.tensor2d([returnArray]);
}

/**
 * Function to handle the processing of submitted comments.
 **/
function handleCommentPost() {
// Only continue if you are not already processing the comment.
    if (! POST_COMMENT_BTN.classList.contains(PROCESSING_CLASS)) {
        POST_COMMENT_BTN.classList.add(PROCESSING_CLASS);
        COMMENT_TEXT.classList.add(PROCESSING_CLASS);
        // Grab the comment text from DOM.
        let currentComment = COMMENT_TEXT.innerText;
        console.log(currentComment);
        // Convert sentence to lower case which ML Model expects
        // Strip all characters that are not alphanumeric or spaces
        // Then split on spaces to create a word array.
        let lowercaseSentenceArray = currentComment.toLowerCase().replace(/[^\w\s]/g,'').split(' ');
        let li = document.createElement('li');
        let p = document.createElement('p');
        p.innerText = COMMENT_TEXT.innerText;
        let spanName = document.createElement('span');
        spanName.setAttribute('class', 'username');
        spanName.innerText = 'Anonymous';
        let spanDate = document.createElement('span');
        spanDate.setAttribute('class', 'timestamp');
        let curDate = new Date();
        spanDate.innerText = curDate.toLocaleString();
        li.appendChild(spanName);
        li.appendChild(spanDate);
        li.appendChild(p);
        COMMENTS_LIST.prepend(li);
        COMMENT_TEXT.innerText = '';
        loadAndPredict(tokenize(lowercaseSentenceArray), li).then(function() {
            POST_COMMENT_BTN.classList.remove(PROCESSING_CLASS);
            COMMENT_TEXT.classList.remove(PROCESSING_CLASS);
        });
    }
}

/**
 * Asynchronous function to load the TFJS model and then use it to
 * predict if an input is spam or not spam. The 2nd parameter
 * allows us to specify the DOM element list item we are currently
 * classifying so we can change it's style if it is spam!
 */
async function loadAndPredict(inputTensor,domComment) {
// Load the model.json and binary files you hosted. Note this is
// an asynchronous operation so you use the await keyword
    if (model === undefined) {
        model = await tf.loadLayersModel(MODEL_JSON_URL);
    }
// Once model has loaded you can call model.predict and pass to it
// an input in the form of a Tensor. You can then store the result.
    var results = await model.predict(inputTensor);
    //let results = model.predict(inputTensor);
// Print the result to the console for us to inspect.
    results.print();

    // you call the ‘dataSync’ method on the results tensor to
    // access its contents.
    //let dataArray = results.dataSync();
    results.data().then((dataArray)=> {
        if (dataArray[1] > SPAM_THRESHOLD) {
            domComment.classList.add('spam');
        } else {
            // Emit socket.io comment event for server to handle containing
            // all the comment data you would need to render the comment on
            // a remote client's front end.
            socket.emit('comment', {
                username: currentUserName,
                timestamp: domComment?.querySelectorAll('span')[1].innerText,
                comment: domComment?.querySelectorAll('p')[0].innerText
            });
        }
    })
}

let socket = io.connect();

function handleRemoteComments(data) {
    // Render a new comment to DOM from a remote client.
    let li = document.createElement('li');
    let p = document.createElement('p');
    p.innerText = data.comment;

    let spanName = document.createElement('span');
    spanName.setAttribute('class', 'username');
    spanName.innerText = data.username;

    let spanDate = document.createElement('span');
    spanDate.setAttribute('class', 'timestamp');
    spanDate.innerText = data.timestamp;

    li.appendChild(spanName);
    li.appendChild(spanDate);
    li.appendChild(p);
    COMMENTS_LIST.prepend(li);
}

// Add event listener to receive remote comments that passed
// spam check.
socket.on('remoteComment', handleRemoteComments);