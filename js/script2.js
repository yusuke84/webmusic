/**
 * Created by yusuke on 2014/01/18.
 */
/**
 * Created by yusuke on 2013/12/20.
 */

//APIキー
var APIKEY = 'cde34d74-7eab-11e3-8dc7-d79150c8e494';

//ユーザーリスト
var userList = [];

//Callオブジェクト
var existingCall;

// Compatibility
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

// PeerJSオブジェクトを生成
var peer = new Peer({ key: APIKEY, debug: 3});

// SpeechSynthesisオブジェクトを生成
var msg = new SpeechSynthesisUtterance();
msg.volume = 1; // 0 to 1
msg.rate = 1; // 0.1 to 10
msg.pitch = 2; //0 to 2
msg.lang = 'ja-JP';
msg.onend = function(e) {
    console.log('Finished in ' + event.elapsedTime + ' seconds.');
};

var conn;

// PeerIDを生成
peer.on('open', function(){
    $('#my-id').text(peer.id);
});

// 相手からのコールを受信したら自身のメディアストリームをセットして返答
peer.on('call', function(call){
    call.answer(window.localStream);
    step3(call);
});

// 相手からのDataChannelの接続要求を受信した場合
peer.on('connection', function(conn_) {
    conn = conn_;
    conn.on('open', function() {
        // メッセージを受信
        conn.on('data', function(data) {
            //speechSynthesis.speak(msg.text);
            binary2str(data,function(low){
                console.log(low.text);
                mikuSpeech(low.text);
            });
        });
    });
});

// エラーハンドラー
peer.on('error', function(err){
    alert(err.message);
    step2();
});


// Web MIDI API
var midi;
var mIn, mOut;
var speechTimerId;
var speechTimerCounter;
navigator.requestMIDIAccess( { sysex: true } ).then( successMidi, failureMidi );

function successMidi(midiAccess)
{

    var inputs, outputs;

    var i=null;
    m=midiAccess;
    inputs=m.inputs();
    outputs=m.outputs();

    //--- 使用可能なデバイスの名前を書き出す(1つしか想定していない) ---
    if(inputs.length>0){
        for(i=0; i<inputs.length; i++)
            $('#inputMidiList').text('INPUT : ' + inputs[0].name);
            mIn = inputs[0];
    }
    if(outputs.length>0){
        for(i=0; i<outputs.length; i++)
            $('#outputMidiList').text('OUTPUT : ' + outputs[0].name);
            mOut = outputs[0];
    }

}

function failureMidi(error)
{
    alert( "NG MIDI が使えません！" )
}

function mikuSpeech(data){

    var sysEx=nsx1.getSysExByText(data);
    var now=window.performance.now();
    for(var i=0; i<sysEx.length; i++)
        mOut.send(sysEx[0], now+i*100);

    var w=nsx1.getSysExByNoteNo(60);
    var now=window.performance.now();

    speechTimerCounter = data.length;
    speechTimerId = setInterval(function(){
        var w=nsx1.getSysExByNoteNo(60);
        var now=window.performance.now();
        mOut.send([0x90, 0x48, 0x7f]);
        mOut.send([0x80, 0x48, 0x00], now+300);
        speechTimerCounter--;
        if(speechTimerCounter == 0){
            clearInterval(speechTimerId);
        }
    },100);

}


// イベントハンドラー
$(function(){

    // 相手に接続
    $('#make-call').click(function(){
        var call = peer.call($('#contactlist').val(), window.localStream);
        conn = peer.connect($('#contactlist').val());
        step3(call,conn);

    });

    // 切断
    $('#end-call').click(function(){
        existingCall.close();
        step2();
    });

    // 送信
    $('#sendtext').click(function(){
        str2binary($('#textdata').val(),function(data){
            var message = {
                text: data
            };
            console.log(message);
            conn.send(message);
        });
    });

    // メディアストリームを再取得
    $('#step1-retry').click(function(){
        $('#step1-error').hide();
        step1();
    });

    // ステップ１実行
    step1();

    //ユーザリス取得開始
    setInterval(getUserList, 2000);

});

function step1 () {
    // メディアストリームを取得する
    navigator.getUserMedia({audio: true, video: true}, function(stream){
        //$('#my-video').prop('src', URL.createObjectURL(stream));
        window.localStream = stream;
        step2();
    }, function(){ $('#step1-error').show(); });
}

function step2 () {
    //UIコントロール
    $('#step1, #step3').hide();
    $('#step2').show();
}

function step3 (call,conn) {
    // すでに接続中の場合はクローズする
    if (existingCall) {
        existingCall.close();
    }

    // 相手からのメディアストリームを待ち受ける
    call.on('stream', function(stream){
        $('#their-video').prop('src', URL.createObjectURL(stream));
        $('#step1, #step2').hide();
        $('#step3').show();
    });

    // 相手がクローズした場合
    call.on('close', step2);

    // DataChannel関連のイベント
    conn.on('open', function() {
        // メッセージを受信
        conn.on('data', function(data) {
            //speechSynthesis.speak(msg.text);
            binary2str(data,function(low){
                console.log(low.text);
                mikuSpeech(low.text);
            });

        });
    });

    // Callオブジェクトを保存
    existingCall = call;

    // UIコントロール
    $('#their-id').text(call.peer);
    $('#step1, #step2').hide();
    $('#step3').show();

}

function getUserList () {
    //ユーザリストを取得
    $.get('https://skyway.io/active/list/'+APIKEY,
        function(list){
            for(var cnt = 0;cnt < list.length;cnt++){
                if($.inArray(list[cnt],userList)<0 && list[cnt] != peer.id){
                    userList.push(list[cnt]);
                    $('#contactlist').append($('<option>', {"value":list[cnt],"text":list[cnt]}));
                }
            }
        }
    );
}

function str2binary(str, callback){
    var reader = new FileReader();
    reader.onload = function(e){
        callback(reader.result);
    };
    reader.readAsArrayBuffer(new Blob([str]));
}

function binary2str(message, callback){
    var reader = new FileReader();
    reader.onload = function(e){
        message.text = reader.result;
        callback(message);
    };
    reader.readAsText(new Blob([message.text]));
}