import { Component, OnInit, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';
import { Store } from '@ngxs/store';
import { CardsState } from '../../stateManagement/cards/cards.state';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { FirebasechatService } from '../../services/firebasechat.service'
import { FirebaseUserService } from '../../services/firebaseUser.service'
import { AngularFireFunctions } from '@angular/fire/functions';
import { CryptoService } from '../../services/crypto.service'
import { AngularFirestore } from '@angular/fire/firestore';
import { AngularFireStorage } from "@angular/fire/storage";
import * as moment from 'moment';
import { AppEventService } from 'src/app/services/event.service';
import { FirebaseProjectService } from 'src/app/services/firebaseProject.service';

@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.scss']
})
export class ChatBoxComponent implements OnInit {
  public cards
  public chatsData = []
  public userDetails
  public decryptionKeyGlobalObject = {}
  public projectChatView = false
  public selectedChat = null
  public globalDate
  public newChat = ''
  public todayDate = moment(new Date()).format('MM/DD/YYYY')
  public yesterdayDate = moment(new Date()).subtract(1, 'days').format("MM/DD/YYYY")
  public fileChats = []
  public downloadURL
  public dodo
  private subscriptionDestroyed$: Subject<void> = new Subject<void>();
  public batch
  @ViewChild('projectChat') projectChatContainer: ElementRef;
  @ViewChild('chatBox') chatBox: ElementRef;
  @ViewChild('unreadMessage') unreadLabel: ElementRef
  public chatBoxClosed = false
  public chatNotLoaded = false
  public globalChatsData = []
  public typingTimer: any
  public searching = false
  public imagePreviewArray = []
  public chatSubscription
  public unreadMessageIndex = {}
  public unreadMesgFound = false
  public skipObj = {}
  public limit = 20
  public unreadIndex = 0
  public attachmentProcessing = false
  public chatProcessingTimout: any
  public showEmojiPopup = false

  showParticipantsMention = false;
  public mentionedParticipants = [];

  constructor(
    private store: Store,
    private firebaseChatService: FirebasechatService,
    private firebaseUserService: FirebaseUserService,
    private ngFireFunctions: AngularFireFunctions,
    private cryptoService: CryptoService,
    private ngFirestore: AngularFirestore,
    private storage: AngularFireStorage,
    private appEventService: AppEventService,
    private firebaseProjectService: FirebaseProjectService
  ) { }

  @Output() stateChange: EventEmitter<Boolean> = new EventEmitter();

  ngOnInit() { }

  async ngAfterViewInit() {
    const subs = this.firebaseUserService.getCurrentUser().pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(userData => {
      subs.unsubscribe();
      const user = userData
      this.userDetails = user
    })
    const cards$ = this.store.select(
      CardsState.getCards()
    );
    cards$.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe((cards) => {
      if (cards) {
        if (cards.length) {
          this.cards = cards
        }
      }
    });
    this.chatProcessingTimout = setTimeout(async () => {
      this.processChatFromCards()
    }, 0)
  }

  async processChatFromCards() {
    const cards = this.cards
    if (this.cards && this.cards.length > 0) {
      for (const project of this.cards) {
        if(!this.chatBoxClosed) {
          const projectChat = await this.getChatsForProject(project)
          if (Object.keys(projectChat).length) {
            if(!this.searching) {
              this.chatsData.push(projectChat)
            }
            this.globalChatsData.push(projectChat)
          }
        } else {
          break
        }
      }
    }
  }

  closeChatBox() {
    // this.stateChange.emit(false)
    this.appEventService.toggleChatBoxView(false)
  }

  getChatsForProject(project) {
    return new Promise((resolve, reject) => {
      const chatSubscription = this.firebaseChatService.getAndListenAllChatById(project.id, 1).subscribe(async (chats) => {
        try {
          const decryptionkeyObject = {}
          const projectChat = {}
          // const decryptionDetails = await this.getDecryptionKeyForChat(chats, project.participants)
          const projectCurrentUser = project.participants.find(user => user.id === this.userDetails.userId)
          if(projectCurrentUser.status !== 2) {
            resolve({})
          }
          // decryptionkeyObject[this.userDetails.userId] = decryptionDetails['rsaDecryptKey']
          // this.decryptionKeyGlobalObject[`${project.id}`] = this.decryptionKeyGlobalObject[`${project.id}`] ? { ...this.decryptionKeyGlobalObject[`${project.id}`], ...decryptionkeyObject } : decryptionkeyObject
          const acroArray = project.name.split(' ')
          projectChat['acronyName'] = (acroArray[0].charAt(0) + (acroArray[1] ? acroArray[1].charAt(0) : '')).trim().toUpperCase()
          projectChat['name'] = project.name
          projectChat['id'] = project.id
          projectChat['image'] = project.image ? project.image : ''
          projectChat['participants'] = project.participants
          projectChat['unreadCount'] = projectCurrentUser['unreadChat']
          projectChat['chatPresent'] = chats.length ? true : false
          // if(decryptionDetails['name']) {
          //   projectChat['displayName'] = decryptionDetails['name'] === this.userDetails.name ? 'You' : decryptionDetails['name']
          // }
          // if (chats.length > 0) {
          //   const counterOp = await this.countUnreadChats(chats[0])
          //   if (counterOp['batchOp']) {
          //     projectChat['readBatch'] = counterOp['batchOp']
          //   }
          //   projectChat['chats'] = chats
          //   projectChat['displayMessage'] = this.cryptoService.decryptData(chats[0].comment, decryptionDetails['rsaDecryptKey'])
          //   projectChat['firstMessageDate'] = moment(parseInt((chats[0].timestamp.seconds * 1000).toString()) + parseInt((chats[0].timestamp.seconds / 1000000).toString()))
          //   projectChat['dateStamp'] = moment(parseInt((chats[0].timestamp.seconds * 1000).toString()) + parseInt((chats[0].timestamp.seconds / 1000000).toString())).format("MMM D");
          //   resolve(projectChat)
          // }
          resolve(projectChat)
        } catch (error) {
          resolve({})
        }
        chatSubscription.unsubscribe()
      }, err => {
        resolve({})
      })
    })
  }

  getDecryptionKeyForChat(chats, participants) {
    return new Promise<Object>((resolve, reject) => {
      if (chats.length > 0) {
        const subs = this.firebaseUserService.getUserByIdForGuard(chats[0].userId).subscribe((userData) => {
          subs.unsubscribe();
          const user = userData
          if (user) {
            const userParticipant = participants.find((participant) => this.userDetails.userId == participant.id)
            let taskSecretKey = this.ngFireFunctions.httpsCallable('getTaskSecretKey');
            taskSecretKey({ secret: userParticipant.secret, publicKey: this.cryptoService.rsaKeyGeneration.rsaPublicKey }).subscribe(async (response) => {
              if (response) {
                const rsaDecryptKey = await this.cryptoService.rsaKeyGeneration.decrypt(response);
                resolve({ rsaDecryptKey, name: user.name })
              }
            }, err => {
              reject(err)
            });
          }
        }, err => {
          subs.unsubscribe();
          reject(err)
        })
      } else {
        const userParticipant = participants.find((participant) => this.userDetails.userId == participant.id)
        let taskSecretKey = this.ngFireFunctions.httpsCallable('getTaskSecretKey');
        taskSecretKey({ secret: userParticipant.secret, publicKey: this.cryptoService.rsaKeyGeneration.rsaPublicKey }).subscribe(async (response) => {
          if (response) {
            const rsaDecryptKey = await this.cryptoService.rsaKeyGeneration.decrypt(response);
            resolve({ rsaDecryptKey })
          }
        }, err => {
          reject(err)
        });
      }
    })
  }

  countUnreadChats(chat) {
    const update = {}
    update[`readStatus.${this.userDetails.userId}`] = true
    const batch = this.ngFirestore.firestore.batch()
    return new Promise<any>((resolve, reject) => {
      this.ngFirestore.collection('chats', ref => ref.where('projectId', '==', chat.projectId).orderBy('timestamp', 'desc').limit(this.limit)).get().subscribe(data => {
        if(data.docs.length) {
          data.docs.forEach(chat => {
            if(!chat.data()['readStatus'][`${this.userDetails.userId}`]) {
              const sfDocRef = this.ngFirestore.collection('chats').doc(chat.id).ref
              batch.update(sfDocRef, update);
            }
          })
          resolve({batchOp: batch})
        } else {
          resolve({count: data.size})
        }
      })
    })
  }

  countUnreadChatsPagination(chat, skip) {
    const update = {}
    update[`readStatus.${this.userDetails.userId}`] = true
    const batch = this.ngFirestore.firestore.batch()
    return new Promise<any>((resolve, reject) => {
      this.ngFirestore.collection('chats', ref => ref.where('projectId', '==', chat.projectId).orderBy('timestamp', 'desc').limit(this.limit).startAfter(skip.timestamp)).get().subscribe(data => {
        let unread = 0
        if(data.docs.length) {
          data.docs.forEach(chat => {
            if(!chat.data()['readStatus'][`${this.userDetails.userId}`]) {
              const sfDocRef = this.ngFirestore.collection('chats').doc(chat.id).ref
              batch.update(sfDocRef, update);
              unread++
            }
          })
          resolve({count: unread, batchOp: batch})
        } else {
          resolve({count: data.size})
        }
      })
    })
  }

  processProjectChat(chat) {
    this.projectChatView = this.projectChatView === false ? true : false
    this.selectedChat = chat
    this.selectedChat['fallbackImg'] = `assets/images/user${moment().unix()}.png`
    this.selectedChat['involvedPerson'] = this.getInvolvedUsersForChat()
    this.skipObj = {}
    this.unreadIndex = 0
    this.fileChats.length = 0
    this.imagePreviewArray.length = 0
    this.unreadMessageIndex = {}
    this.getChatForParticularProject(this.selectedChat)
    
    this.showParticipantsMention = false;
    setTimeout(() => {
      if (this.chatBox) {
        this.clearReplyingToUI();
      }
    }, 0);
  }

  getChatForParticularProject(selectedProjectChat) {
    if(selectedProjectChat.chatPresent) {
      this.chatNotLoaded = true
    }
    if(this.chatSubscription) {
      this.chatSubscription.unsubscribe()
    }
    this.chatSubscription = this.firebaseChatService.getAndListenAllChatById(selectedProjectChat.id, this.limit).subscribe(async (chats) => {
      try {
        const decryptedChats = {}
        const decryptionkeyObject = {}
        this.skipObj = chats[chats.length - 1]
        if(!this.decryptionKeyGlobalObject[`${selectedProjectChat.id}`]) {
          const decryptionDetails = await this.getDecryptionKeyForChat(chats, selectedProjectChat.participants)
          decryptionkeyObject[this.userDetails.userId] = decryptionDetails['rsaDecryptKey']
          this.decryptionKeyGlobalObject[`${selectedProjectChat.id}`] = this.decryptionKeyGlobalObject[`${selectedProjectChat.id}`] ? { ...this.decryptionKeyGlobalObject[`${selectedProjectChat.id}`], ...decryptionkeyObject } : decryptionkeyObject
        }
        if(chats.length) {
          const index = this.chatsData.findIndex(chat => chat.id === chats[0].projectId)
          this.chatsData[index]['chats'] = [chats[0]]
          this.chatsData[index]['displayMessage'] = this.cryptoService.decryptData(chats[0].comment.replace(/\n/g, ""), this.decryptionKeyGlobalObject[`${chats[0].projectId}`][`${this.userDetails.userId}`])
          const counterOp = await this.countUnreadChats(chats[0])
          if (counterOp['batchOp']) {
            counterOp['batchOp'].commit().then().catch((err) => {
              throw err
            })
            delete this.selectedChat['readBatch']
            // this.unreadMessageIndex = {}
          }
          this.chatsData[index]['unreadCount'] = this.chatsData[index]['unreadCount'] > this.limit ? this.chatsData[index]['unreadCount'] - this.limit : this.chatsData[index]['unreadCount']
          for (const [i,chat] of chats.entries()) {
            if(chat['readStatus'][this.userDetails.userId]) {
              this.unreadMesgFound = true
            }
            if(chat['readStatus'][this.userDetails.userId] === undefined && !this.unreadMesgFound) {
              this.unreadMessageIndex['id'] = chats[i].id
              this.unreadMessageIndex['index'] = this.unreadIndex
              this.unreadIndex++
            }
            if (this.decryptionKeyGlobalObject[`${chat.projectId}`]) {
              try {
                chat['decryptedComment'] = await this.getDecryptedChat(chat)
                if(chat.reply) {
                  const reply = await this.getDecryptedChat(chat.reply)
                  if(reply.length) {
                    chat['repliedTo'] = reply
                  }
                }
                if (chat.timestamp) {
                  const newDayMapper = moment(parseInt((chat.timestamp.seconds * 1000).toString()) + parseInt((chat.timestamp.seconds / 1000000).toString()))
                  chat['timestampMiliseconds'] = moment(parseInt((chat.timestamp.seconds * 1000).toString()) + parseInt((chat.timestamp.seconds / 1000000).toString()))
                  chat['miniStamp'] = moment(parseInt((chat.timestamp.seconds * 1000).toString()) + parseInt((chat.timestamp.seconds / 1000000).toString())).format("h:mm a");
                  if (decryptedChats[`${newDayMapper.format('MM/DD/YYYY')}`]) {
                    decryptedChats[`${newDayMapper.format('MM/DD/YYYY')}`].push(chat)
                  } else {
                    decryptedChats[`${newDayMapper.format('MM/DD/YYYY')}`] = [chat]
                  }
                }
              } catch (error) {
                chat['decryptedComment'] = '...'
              }
            }
          }
          this.chatsData[index]['currentChats'] = decryptedChats
          this.chatNotLoaded = false
          this.chatBox.nativeElement.focus();
          this.scrollContentToBottom();
        } else {
          this.chatNotLoaded = false
        }
      } catch (error) {
        return ({})
      }
      // chatSubscription.unsubscribe()
    }, err => {
      return ({})
    })
  }

  async getDecryptedChat(chat) {
    try {
      let decryptedMessage = ''
      const names = this.selectedChat.involvedPerson.names
      if (chat.projectId) {
        decryptedMessage = this.cryptoService.decryptData(chat.comment.replace(/\n/g, ""), this.decryptionKeyGlobalObject[`${chat.projectId}`][`${this.userDetails.userId}`])
      } else {
        decryptedMessage = this.cryptoService.decryptData(chat.comment.replace(/\n/g, ""), this.decryptionKeyGlobalObject[`${this.selectedChat.id}`][`${this.userDetails.userId}`])
      }
      decryptedMessage = decryptedMessage.replace(/\n/g, "<br/>");
      const ids = decryptedMessage.match(/@[A-Za-z0-9_]*(\b)/g);
      if (ids) {
        for (let userId of ids) {
          userId = userId.trim()
          userId = userId.substring(1)
          if (names[userId]) {
            const re = new RegExp("@" + userId, "g");
            decryptedMessage = decryptedMessage.replace(re, `<b>@${names[userId]}</b>`);
          } else if (userId) {
            const re = new RegExp("@" + userId, "g");
            const name = await this.getMissedUserDetails(userId)
            decryptedMessage = decryptedMessage.replace(re, `<b>@${name}</b>`)
          }
        }
      }
      return decryptedMessage
    } catch(error) {
      throw error
    }
  }

  showParticipants() {
    this.showParticipantsMention = true;
    setTimeout(() => {
      this.chatBox.nativeElement.blur();
    }, 0);
  }

  addParticipantInMentioned_N_ShowNameInChat(chat) {
    this.showParticipantsMention = false;
    
    if (this.mentionedParticipants.indexOf(chat.id) == -1) {
      this.mentionedParticipants.push(chat.id);
    }
    let previousChat = this.chatBox.nativeElement.innerHTML;
    
    if(previousChat.indexOf('@</span>') == previousChat.length - 8) {
      previousChat = previousChat.slice(0, previousChat.length - 8);
      this.chatBox.nativeElement.innerHTML = `${previousChat}</span><span id="i_${chat.id}">@${chat.name}</span>&nbsp;`;
    } else {
      previousChat = previousChat.slice(0, previousChat.length - 1);
      this.chatBox.nativeElement.innerHTML = `${previousChat}<span id="i_${chat.id}">@${chat.name}</span>&nbsp;`;
    }

    setTimeout(() => {
      this.placeCaretAtEnd(this.chatBox.nativeElement)
    }, 0)
  }

  placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection != "undefined"
      && typeof document.createRange != "undefined") {
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  setMaxWidth() {
    this.showParticipantsMention = false;
    setTimeout(() => {
      if (this.chatBox) {
        let reply_width = 0
        this.chatBox.nativeElement.style.maxWidth = (this.chatBox.nativeElement.parentElement.offsetWidth - 20 - 20 - reply_width - 3 - 5) + 'px';
      }
    }, 0);
  }

  getInvolvedUsersForChat() {
    const users = []
    const chatUserData = []
    const profileImages = {}
    const profielNames = {}
    this.selectedChat.participants.forEach(person => {
      const participants = {}
      const subs = this.firebaseUserService.getUserByIdForGuard(person.id).subscribe((userData) => {
        subs.unsubscribe();
        profileImages[person.id] = userData.profileImage ? userData.profileImage : ""
        profielNames[person.id] = userData.name ? userData.name : ""
        const user = userData
        participants['id'] = userData.id;
        participants['name'] = userData.name ? userData.name : "";
        participants['profile'] = userData.profileImage ? userData.profileImage : ""
        if (user) {
          users.push(user.name)
          chatUserData.push(participants)
        }
      }, err => {
        subs.unsubscribe();
        throw (err)
      })
    })
    return { user: users, profiles: profileImages, names: profielNames, mentionedDetails: chatUserData}
  }

  onMessageTypeKeyUp(event: any) {
    if (this.newChat != '' && event.key == 'Enter' && !event.shiftKey) {
      this.addChat(this.selectedChat);
      return;
    }
  }

  async addChat(chat) {
    const index = this.chatsData.findIndex(singleChat => singleChat.id === chat.id)
    this.chatsData[index]['chatPresent'] = true
    let chatsArray
    const fileChats = Object.assign([], this.fileChats);
    this.fileChats.length = 0
    if (fileChats.length > 0) {
      chatsArray = await this.generateImageChatArray(fileChats, chat)
    } else if (fileChats.length === 0) {
      chatsArray = await this.generateSimpleChatArray(chat)
    }
    this.postChat(chatsArray)
  }

  getChatReference() {
    return new Promise<string>((resolve, reject) => {
      this.ngFirestore.collection('chats').doc().get().subscribe(res => {
        resolve(res.ref.id)
      })
    })
  }

  async backToList() {
    this.projectChatView = this.projectChatView === true ? false : false
    if (this.selectedChat.chats?.length) {
      const counterOp = await this.countUnreadChats(this.selectedChat.chats[0])
      this.selectedChat['unreadCount'] = counterOp['count']
      if (counterOp['batchOp']) {
        this.selectedChat['readBatch'] = counterOp['batchOp']
      }
    }
    this.selectedChat['currentChats'] = []
    this.fileChats.length = 0
  }

  async sendPictureChat(event) {
    const file = event.target.files[0];
    const validFile = this.checkValidations(file)
    if (validFile && this.fileChats.length <= 4) {
      this.fileChats.push(file)
    } else {
      return
    }
    let counter = 1
    for(const file of this.fileChats) {
      this.imagePreviewArray = []
      const mimeType = file.type;
      if (mimeType.match(/image\/*/) === null) {

      } else {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (_event) => {
          this.imagePreviewArray.push({url: reader.result, id: counter})
          counter = counter + 1
        }
      }
    }
  }

  removeAttachment(img) {
    var index = this.imagePreviewArray.map(item => item.id).indexOf(img.id);
    this.fileChats.splice(index, 1)
    this.imagePreviewArray.splice(index, 1)
  }

  checkValidations(file) {
    var re = /(\.jpg|\.jpeg|\.png)$/i;
    if (!re.exec('.' + (file.type.split('/'))[1])) {
      return false
    } else {
      return true
    }
  }

  generateImageChatArray(fileChats, chat) {
    this.getChatInnerHTML();
    const imageChat = []
    this.attachmentProcessing = true
    let chatMessage
    return new Promise<Array<any>>(async (resolve, reject) => {
      for (const file of fileChats) {
        const chatObject = {}
        const fileBio = file.name.split('.')
        const data = await this.generateBase64Data(file)
        if(this.newChat) {
          chatMessage = this.newChat.trim()
          this.newChat = ""
          if (chatMessage) {
            const encyptedComment = await this.cryptoService.encryptData(chatMessage, this.decryptionKeyGlobalObject[`${chat.id}`][`${this.userDetails.userId}`]);
            chatObject['comment'] = encyptedComment
          }
        } else {
          const encyptedComment = await this.cryptoService.encryptData(chatMessage, this.decryptionKeyGlobalObject[`${chat.id}`][`${this.userDetails.userId}`]);
          chatObject['comment'] = encyptedComment
        }
        const readStatus = {}
        readStatus[`${this.userDetails.userId}`] = true
        chatObject['commentType'] = 2
        chatObject['fileExt'] = fileBio[1]
        chatObject['fileName'] = fileBio[0]
        chatObject['thumbnailUrl'] = data
        chatObject['imgThumb'] = data
        chatObject['fileUrl'] = await this.uploadPicture(file)
        chatObject['projectId'] = chat.id
        chatObject['timestamp'] = new Date()
        chatObject['readStatus'] = readStatus
        chatObject['userId'] = this.userDetails.userId
        chatObject['mediaElapsedMillis'] = 0
        chatObject['reply'] = null
        chatObject['fileSize'] = file.size
        imageChat.push(chatObject)
      }
      resolve(imageChat)
    })
  }

  generateSimpleChatArray(chat) {
    this.getChatInnerHTML();
    const simpleChat = []
    return new Promise<Array<any>>(async (resolve, reject) => {
      const chatObject = {}
      const chatMessage = this.newChat.trim()
      this.newChat = ""
      if (chatMessage.length) {
        const encyptedComment = await this.cryptoService.encryptData(chatMessage, this.decryptionKeyGlobalObject[`${chat.id}`][`${this.userDetails.userId}`]);
        const readStatus = {}
        readStatus[`${this.userDetails.userId}`] = true
        chatObject['comment'] = encyptedComment
        chatObject['commentType'] = 1
        chatObject['projectId'] = chat.id
        chatObject['timestamp'] = new Date()
        chatObject['readStatus'] = readStatus
        chatObject['userId'] = this.userDetails.userId
        simpleChat.push(chatObject)
      }
      resolve(simpleChat)
    })
  }

  getChatInnerHTML() {
    this.showParticipantsMention = false;
    const chatBoxElement = this.chatBox.nativeElement;
    this.mentionedParticipants.forEach(p_id => {
      const user = this.selectedChat.participants.find(_participant => _participant.id == p_id);
      
      const spanElRf = chatBoxElement.querySelectorAll(`#i_${p_id}`);
      spanElRf.forEach(element => {
        element.innerHTML = this.replaceNameByIdUsingRegEx(element.innerHTML, user); // this will replace word
        element.innerHTML = element.innerHTML.replace(`@${user.name}`, `@${p_id}&nbsp;`); // this will replace substring
      });
    });

    const comment = this.chatBox.nativeElement.innerText.trim();
    
    this.newChat = comment
    this.chatBox.nativeElement.innerHTML = '';
  }

  replaceNameByIdUsingRegEx(str, user) {
    const re = new RegExp(`(@${user.name})(\\b)`);
    str = str.replace(re, `@${user.id}`);
    return str;
  }

  uploadPicture(file) {
    return new Promise<string>((resolve, reject) => {
      const fileName = file.name;
      const filePath = `images/`;
      const fileRef = this.storage.ref(`${filePath}${fileName}`);
      const task = this.storage.upload(`${filePath}${fileName}`, file);
      task
        .snapshotChanges()
        .pipe(takeUntil(this.subscriptionDestroyed$))
        .pipe(
          finalize(() => {
            this.downloadURL = fileRef.getDownloadURL();
            this.downloadURL.pipe(takeUntil(this.subscriptionDestroyed$)).subscribe(url => {
              if (url) {
                console.log(url)
                resolve(url)
              }
            });
          })
        )
        .subscribe(url => {
          if (url) {
            console.log(url);
          }
        });
    })
  }

  async postChat(chatsArray) {
    if (chatsArray.length > 0) {
      for (const chat of chatsArray) {
        const { fileSize, ...chatData } = chat
        const chatId = await this.getChatReference()
        chatData['id'] = chatId
        this.ngFirestore.collection('chats').doc(chatId).set(chatData, { merge: true }).then(() => {
          this.clearReplyingToUI();
          this.scrollContentToBottom();
        })
      }
      this.chatBox.nativeElement.innerText = ''
      this.chatBox.nativeElement.innerHTML = ''
    }
    this.fileChats.length = 0
    this.imagePreviewArray.length = 0
    this.unreadMessageIndex = {}
    this.attachmentProcessing = false
    this.uploadFiles(chatsArray)
  }

  async uploadFiles(files) {
    const filesData = {}
    for(let file of files) {
      if (file['fileUrl']) {
        filesData['thumbUrl'] = file['imgThumb']
        filesData['url'] = file['fileUrl']
        filesData['projectId'] = this.selectedChat.id;
        filesData['name'] = file['fileName']
        filesData['ext'] = file['fileExt']
        filesData['size'] = file['fileSize'];
        filesData['timestamp'] = new Date();

        const userId = this.userDetails.userId;
        filesData['createdBy'] = userId;

        const readStatus = {};
        readStatus[userId] = true;
        filesData['readStatus'] = readStatus;

        const fileId = await this.getFileReference();
        filesData['id'] = fileId;
        this.insertFileDocToDB(filesData);
      }
    }
  }

  getFileReference() {
    return new Promise<string>((resolve, reject) => {
      this.ngFirestore.collection('projects').doc(this.selectedChat.id).collection('files').doc().get().subscribe(res => {
        resolve(res.ref.id)
      })
    })
  }

  insertFileDocToDB(file) {
    this.ngFirestore.collection('projects').doc(this.selectedChat.id).collection('files').doc(file.id).set(file, { merge: true }).then(() => {
    }).catch(() => {
    })
  }

  generateBase64Data(file) {
    return new Promise<string>((resolve, reject) => {
      var reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function (e) {
        var image = new Image();
        image.onload = function (imageEvent) {
          // Resize the image using canvas  
          var canvas = document.createElement('canvas'),
            max_size = 10,  
            width = image.width,
            height = image.height;
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  
          //Getting base64 string;  
          var dataUrl = canvas.toDataURL();
          dataUrl = dataUrl.replace(/^data:image\/(png|jpg|jpeg);base64,/, "")
          resolve(dataUrl)
        }
        image.src = (e.target.result).toString();
      }
    })
  }

  clearReplyingToUI () {
    this.newChat = ""
    this.chatBox.nativeElement.innerText = '';
    this.chatBox.nativeElement.innerHTML = '';
    this.mentionedParticipants = [];
  }

  scrollContentToBottom() {
    setTimeout(() => {
      if(this.unreadLabel) {
        setTimeout(() => {
          this.projectChatContainer.nativeElement.scrollTop = this.unreadLabel.nativeElement.offsetTop - 20
        }, 0);
      } else {
        setTimeout(() => {
          this.projectChatContainer.nativeElement.scrollTop = this.projectChatContainer.nativeElement.scrollHeight - this.projectChatContainer.nativeElement.clientHeight;
        }, 0);
      }
    }, 1000);
    
  }

  onChatChange (message) {
    this.newChat = message.trim()
  }

  onChatSend(e) {
    if(e.keyCode == 13 && !e.shiftKey) {
      return false
    }

    if (e.key == '@' || (e.shiftKey && e.key == '2')) {
      this.showParticipants();
    }
  }

  isEmptyObject(obj) {
    return (obj && (Object.keys(obj).length === 0));
  }

  onKeyUp(event: any) {
    clearTimeout(this.typingTimer)
    this.typingTimer = setTimeout(() => {
      this.doneTyping(event.target.value)
    }, 500);
  }

  onKeyDown() {
    clearTimeout(this.typingTimer)
  }

  async doneTyping(searchString) {
    this.searching = true
    if(this.chatProcessingTimout) {
      clearTimeout(this.chatProcessingTimout)
    }
    if(searchString.length === 0) {
      this.chatsData = JSON.parse(JSON.stringify(this.globalChatsData))
    }
    if(searchString.length > 0) {
      this.chatsData.length = 0
      for(let card of this.cards) {
        if(card.name.includes(searchString)) {
          const projectChat = await this.getChatsForProject(card)
          if (Object.keys(projectChat).length) {
            this.chatsData.push(projectChat)
          }
        }
      }
    }
  }

  checkScrollTop(event) {
    const scroll = event.target.scrollTop;
    this.unreadMesgFound = false
    if(scroll === 0) {
      if(Object.keys(this.skipObj).length) {
        this.addNewChats()
      }
    }
  }

  addNewChats() {
    const chatSubscription = this.firebaseChatService.getPaginationOfChat(this.selectedChat.id, this.limit, this.skipObj).subscribe(async (res) => {
      const chats = res.docs
      const decryptedChats = {}
      chatSubscription.unsubscribe()
      if (chats.length) {
        const index = this.chatsData.findIndex(chat => chat.id === chats[0].data().projectId)
        const counterOp = await this.countUnreadChatsPagination(chats[0].data(), this.skipObj)
        if (counterOp['batchOp']) {
          counterOp['batchOp'].commit().then().catch((err) => {
            throw err
          })
          delete this.selectedChat['readBatch']
          // this.unreadMessageIndex = {}
        }
        this.chatsData[index]['unreadCount'] = this.chatsData[index]['unreadCount'] - counterOp.count

        for (const [i, chatData] of chats.entries()) {
          const chat = chatData.data()

          if (chat['readStatus'][this.userDetails.userId]) {
            this.unreadMesgFound = true
          }
          if (chat['readStatus'][this.userDetails.userId] === undefined && !this.unreadMesgFound) {
            this.unreadMessageIndex['id'] = chats[i].id
            this.unreadMessageIndex['index'] = this.unreadIndex
            this.unreadIndex++
          }
          let decryptedMessage = ''
          if (this.decryptionKeyGlobalObject[`${chat.projectId}`]) {
            try {
              chat['decryptedComment'] = await this.getDecryptedChat(chat)
              if (chat.reply) {
                const reply = await this.getDecryptedChat(chat.reply)
                if (reply.length) {
                  chat['repliedTo'] = reply
                }
              }
              if (chat.timestamp) {
                const newDayMapper = moment(parseInt((chat.timestamp.seconds * 1000).toString()) + parseInt((chat.timestamp.seconds / 1000000).toString()))
                chat['timestampMiliseconds'] = moment(parseInt((chat.timestamp.seconds * 1000).toString()) + parseInt((chat.timestamp.seconds / 1000000).toString()))
                chat['miniStamp'] = moment(parseInt((chat.timestamp.seconds * 1000).toString()) + parseInt((chat.timestamp.seconds / 1000000).toString())).format("h:mm a");
                if (decryptedChats[`${newDayMapper.format('MM/DD/YYYY')}`]) {
                  decryptedChats[`${newDayMapper.format('MM/DD/YYYY')}`].push(chat)
                } else {
                  decryptedChats[`${newDayMapper.format('MM/DD/YYYY')}`] = [chat]
                }
              }
            } catch (error) {
              chat['decryptedComment'] = '...'
            }
          }
        }
        if (Object.keys(this.chatsData[index]['currentChats'])) {
          Object.keys(decryptedChats).forEach(date => {
            if (this.chatsData[index]['currentChats'][date]) {
              this.chatsData[index]['currentChats'][date] = [...this.chatsData[index]['currentChats'][date], ...decryptedChats[date]]
            } else {
              this.chatsData[index]['currentChats'][date] = decryptedChats[date]
            }
          })
        } else {
          this.chatsData[index]['currentChats'] = decryptedChats
        }
        this.skipObj = chats[chats.length - 1].data()
      }
    })
  }

  async getMissedUserDetails(userId) {
    const user: any = await this.firebaseProjectService.getUserById_N_addOrUpdateUserGloblly(userId)
    if (user === userId) {
      return userId
    } else {
      const involvedPerson = this.selectedChat['involvedPerson']
      involvedPerson.names[userId] = user.name
      involvedPerson.profiles[userId] = user.profileImage
      this.selectedChat['involvedPerson'] = involvedPerson
      return user.name
    }
  }

  showEmojiMarket() {
    this.showEmojiPopup = !this.showEmojiPopup
  }

  addEmoji(event) {
    this.chatBox.nativeElement.innerHTML += event.emoji.native
    this.newChat += event.emoji.native
  }

  onClickedOutside(e: Event) {
    this.showEmojiPopup = !this.showEmojiPopup
  }

  ngOnDestroy() {
    this.subscriptionDestroyed$.next();
    this.subscriptionDestroyed$.complete();
    this.chatBoxClosed = true
    if(this.chatSubscription) {
      this.chatSubscription.unsubscribe()
    }
  }
}
