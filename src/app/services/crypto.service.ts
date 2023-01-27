import { Injectable } from '@angular/core';
import * as cryptoJs from 'crypto-js/';
import { JSEncrypt } from 'jsencrypt';
import * as forge from 'node-forge'

import * as JsEncryptModule from 'jsencrypt';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  public rsaKeyGeneration: any
  public cryptoRSA: any

  constructor() {
    this.cryptoRSA = new JSEncrypt()
    this.rsaKeyGeneration = new JsEncryptModule.JSEncrypt({default_key_size: 2048});
    this.generateKeysB64();
  }

  public generateKeysB64():void {
    this.rsaKeyGeneration.rsaPrivateKey = this.rsaKeyGeneration.getPrivateKeyB64();
    this.rsaKeyGeneration.rsaPublicKey = this.rsaKeyGeneration.getPublicKeyB64();
  }

  generateKey(refId: string) {
    const salt = cryptoJs.lib.WordArray.random(128 / 8);
    const key128Bits = cryptoJs.PBKDF2(refId, salt, {
      keySize: 128 / 32
    });
    return cryptoJs.enc.Base64.stringify(key128Bits)
  }

  encryptData(data: string, key: string) {
    const cipherKey = cryptoJs.enc.Base64.parse(key)
    return cryptoJs.AES.encrypt(data, cipherKey,{
            mode:cryptoJs.mode.ECB,
            padding:cryptoJs.pad.Pkcs7
    }).toString()
  }

  decryptData(cipher: string, key: string) {
    const cipherKey = cryptoJs.enc.Base64.parse(key)
    const bytes = cryptoJs.AES.decrypt(cipher, cipherKey,{
        mode:cryptoJs.mode.ECB,
        padding:cryptoJs.pad.Pkcs7
    })
    return bytes.toString(cryptoJs.enc.Utf8)
  }

  rsaEncryption(rowData:string, publicKey: string) {
    const pemKey = `-----BEGIN PUBLIC KEY-----\n${publicKey.replace(/\s+$/, "")}\n-----END PUBLIC KEY-----`;
    let rsa = forge.pki.publicKeyFromPem(pemKey);
    let buffer = forge.util.createBuffer(rowData, 'utf8');
    let binaryString = buffer.getBytes();
    let encrypted = rsa.encrypt(binaryString, 'RSA-OAEP', {
        md: forge.md.sha256.create(),
        mgf1: {
            md: forge.md.sha256.create()
        }
    });
    return forge.util.encode64(encrypted);
  }
}
