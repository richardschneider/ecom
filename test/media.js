'use strict';

var request = require("supertest-as-promised");
var server = require('../server');
var medialink = require('../server/model/medialink');
var crypto = require('crypto');

server.timeout = 10000;

describe('Media', function () {

    var uploadResponse;
    var url;
    let content = '<b>Hello world</b>';
    
    before(function (done) {
        request(server)
            .post('/api/media')
            .attach('media', new Buffer(content), 'hello.html')
            .expect(function (res) {
                uploadResponse = res;
                url = uploadResponse.header['location'];
            })
            .end(done);
    });
    
    describe('Uploading', function () {
        it('should return 201 on success', function (done) {
            uploadResponse.status.should.equal(201);
            done();
        });
        
        it('should return Last-Modified header', function (done) {
            uploadResponse.header['last-modified'].should.match(/GMT/);
            done();
        });
    
        it('should return a valid media link in Location header', function (done) {
            uploadResponse.header['location'].should.match(medialink);
            done();
        });
        
        it('should allow viewing of the uploaded media', function (done) {
            request(server)
                .get(url)
                .expect(200)
                .end(done);
        });
    });
   
    describe('Content', function () {
        var response;

        before(function (done) {
            request(server)
                .get(url)
                .expect(200)
                .expect(function (res) {
                    response = res;
                })
                .end(done);
        });
        
        it('should have the correct value', function (done) {
            response.text.should.equal(content);
            done();
        });
        
        it('should have the correct Content-Type header', function (done) {
            response.header['content-type'].should.match(/^text\/html/);
            done();
        });
        
        it('should have the correct Content-MD5 base64 hash', function(done) {
            let digest = crypto.createHash('md5').update(content).digest('base64');
            response.header['content-md5'].should.equal(digest);
            done();
        });

        it('should allow caching forever because media is idempotent', function(done) {
            response.header['cache-control'].should.equal('max-stale=31536000');
            done();
        });
    });
    
    describe('Entity', function () {
        var response;

        before(function (done) {
            request(server)
                .get(url.slice(0, -8)) // remove "/content"
                .expect(200)
                .expect(function (res) {
                    response = res;
                })
                .end(done);
        });
        
        it('should be JSON', function (done) {
            response.header['content-type'].should.match(/^application\/json/);
            response.body.should.not.equal({});
            done();
        });

        it('should contain media information', function (done) {
            response.body.filename.should.equal('hello.html');
            done();
        });
        
        it('should not be changed', function (done) {
            request(server)
                .put(url.slice(0, -8)) // remove "/content"
                .send(response.body)
                .expect(405)
                .end(done);
        });
    });

});
