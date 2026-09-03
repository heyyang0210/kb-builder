Created by 史鑫 on 三月 22, 2024

## 一、协议格式

### REQ：

|类型|名称|描述|合法值|边界值|
|:---|:---|:---|:---|:---|
|CodUint32|clientVersion|connVer|  
|  
|
|CodUint8|loginMethod|  
|typedef enum EnCsLogInMethod {    
  CS_LOGIN_DIGEST = 1,    
  CS_LOGIN_OS,    
  __CS_LOGIN_METHOD_COUNTS__,    
  } CsLogInMethod;|  
|
|CodUint8|userRole|  
|  
|  
|
|CodUint8|conServerMode|心跳强制为DEDICATE_MODE|typedef enum EnConnServerMode {    
  SHARED_MODE = 0,    
  DEDICATE_MODE = 1,    
  } ConnServerMode;|  
|
|CodUint8|flags|CodUint8 isHbConn : 1;    
  CodUint8 unused : 7;|  
|  
|
|CodText|user|len(YacUint8)+data|  
|  
|
|CodText|osUser|len(YacUint8)+data|  
|  
|
|CodText|hostName|len(YacUint8)+data|  
|  
|
|CodText|program|len(YacUint8)+data|  
|  
|


  


### ACK：

AckLoginKey

|类型|名称|描述|合法值|边界值|
|:---|:---|:---|:---|:---|
|CodUint32|encryVersion|sha512|  
|  
|
|CodUint32|transEncryVersion|aes|  
|  
|
|CodUint16|saltLen|密码盐值长度|  
|  
|
|CodUint16|ecretKeyLen|密钥（密文）长度|  
|  
|
|CodChar*|salt|密码盐值|  
|  
|
|CodChar*|secretKey|密钥（密文）|  
|  
|


### DIGEST

|类型|名称|描述|合法值|边界值|
|:---|:---|:---|:---|:---|
|YacUint16|encryDigLen|密码（密文）长度|  
|  
|
|CodChar*|encryDigest|密码（密文）|  
|  
|


## AckLogin

|类型|名称|描述|合法值|边界值|
|:---|:---|:---|:---|:---|
|CodUint16|sid|session id，handlerPool的slot|  
|  
|
|CodUint16|unused|  
|  
|  
|
|CodUint32|version|connVer|  
|  
|
|CodUint32|sKey|  
|  
|  
|
|CodChar|info[ANS_LOGONINFO_BUFFER_SIZE]|服务端版本信息：名字/Version|  
|  
|


## 二、被使用场景

登录

## 三、接收发送流程

  


## 四、异常场景排查拦截

  


  


## 五、跨包支持情况

  


  


## 六、anlStmt相关字段

  


## 七、完成情况

## Attachments:

[image2024-3-20_18-13-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmRhMWFkOWEzMzExZGM5MTAxIiwicmVmX2lkIjoiNjczOTZkNmQ1OTNmOTljOWZmMjM3YjIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MjA3LCJleHAiOjE3ODIzOTQ2MDd9.XFpig4uyHLjRSZs3NDJnZvJyNa-p5zk-1Q6ZpgTLOlw)

 (image/png)    


[image2024-3-20_11-52-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmQ4OTcwYzJhZjRmNTIxMjkyIiwicmVmX2lkIjoiNjczOTZkNmQ1OTNmOTljOWZmMjM3YjIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MjA3LCJleHAiOjE3ODIzOTQ2MDd9.sxtNGHJqhjkxkFATqkm-JVBHTEGgdJ8Ll0A8B-uCxSY)

 (image/png)    


[image2024-3-20_14-39-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmRhMWFkOWEzMzExZGM5MTAyIiwicmVmX2lkIjoiNjczOTZkNmQ1OTNmOTljOWZmMjM3YjIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MjA3LCJleHAiOjE3ODIzOTQ2MDd9.JkQXtkKSxSX14Lcvz9EF1OB0L4FeIJclQsIZtiLKRUg)

 (image/png)    


[image2024-3-20_15-13-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmRhMWFkOWEzMzExZGM5MTAzIiwicmVmX2lkIjoiNjczOTZkNmQ1OTNmOTljOWZmMjM3YjIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MjA3LCJleHAiOjE3ODIzOTQ2MDd9.k4xioh7-LbBwsc7YHG7_K8bsVenBvB8FEB0mRFXzEZ4)

 (image/png)    
