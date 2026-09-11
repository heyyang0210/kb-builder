Created by 冯皓博, last modified on 三月 21, 2024

## 一、协议格式

### REQ：

无

### ACK：

自定义

## 二、被使用场景

1、DBMS_OUTPUT：anrSendOutput

2、batchinsert的错误信息：anrSendBatInsOutput

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d6e8970c2af4f521295/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFJQUFBQWdBQUFFQWdBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgyNTYsImV4cCI6MTc4MjMxOTA1Nn0.6CSoEQ4PRT0yU_OzuRw1h7H4-C3DIJgxnOYRWqGzYYI)

整改项：

1、

![](https://pingcode.yasdb.com/atlas/files/public/67396d6ea1ad9a3311dc910a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFJQUFBQWdBQUFFQWdBQUFBQUlBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgyNTYsImV4cCI6MTc4MjMxOTA1Nn0.6CSoEQ4PRT0yU_OzuRw1h7H4-C3DIJgxnOYRWqGzYYI)

CMD_OUTPUT的使用场景一般是在当前命令字的ACK发回前发回一些额外信息给到客户端，此时客户端注册回调函数来处理。

这样就要求CMD_OUTPUT不能使用：CsPacket* packet = &session→sendPacket;

否则可能导致某处写好的报文被覆盖。

此处csSendBytes最好组成单次发送

  


## 四、异常场景排查拦截

  


## 五、跨包支持情况

1、支持多个CMD_OUTPUT连续，只要业务逻辑主处理清楚就可以

  


## 六、anlStmt相关字段

  


## 七、完成情况

  


## Attachments:

## Comments:

|  [](null)  ,Posted by fenghaobo at 五月 13, 2024 17:45|
|---|
|客户端|服务端|处理|
|新|老|老服务端不支持GETLINE函数，走老CMD_OUTPUT|
|新|新|执行ack读完后，触发一个GETLINE存储过程执行，执行完调回调|
|老|老|  
|
|老|新|需要在执行ack发走前，将CMD_QUERY发完（可能需要执行forkstmt+存储过程出参）|


|客户端|服务端|处理|
|---|---|---|
|新|老|老服务端不支持GETLINE函数，走老CMD_OUTPUT|
|新|新|执行ack读完后，触发一个GETLINE存储过程执行，执行完调回调|
|老|老|  
|
|老|新|需要在执行ack发走前，将CMD_QUERY发完（可能需要执行forkstmt+存储过程出参）|
