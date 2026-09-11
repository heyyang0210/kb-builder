Created by 侯忠林, last modified on 三月 21, 2024

  [LOB协议 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=68294902)  

## 一、协议格式

### REQ：

请求报文的格式为 reqLob+body

reqLob

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint8|opr|lob操作|LOB_GET_LEN = 1    
  LOB_READ = 2    
  LOB_TRIM = 3    
  LOB_WRITE = 4    
  LOB_TMP_CREATE = 5    
  LOB_TMP_FREE = 6    
  LOB_OPEN = 7    
  LOB_CLOSE = 8    
  LOB_ISOPEN = 9    
  LOB_GET_CHUNK_SIZE = 10|  
|
|CodUint8:  1|dataIsLob|发送的数据是否是CsLobLocator|0,1|  
|
|CodUint8 : 1|isStream|是否使用流发送数据|0,1|  
|
|CodUint8 : 1|isCharReq|请求的是否是字符长度|0,1|  
|
|CodUint8 : 5|reserve|保留字|  
|  
|
|CodUint8 |lobType|请求的lob类型|29（clob）,30(blob),33(nclob)|  
|
|CodUint8 |locLen|CsLobLocator的长度|72（版本1）,80(版本2)|  
|
|CodUint32|reqLen|请求数据的长度|>= 0|  
|
|CodUint64|offset|请求LOB数据的偏移位|>= 0|  
|
|CsLobLocator|locator|请求lob的CsLobLocator|合法的CsLobLocator|  
|


### ACK：

返回报文的格式为 ackLob + body

 ackLob ：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint8|locatorLen|lob操作|72（版本1）,80(版本2)|  
|
|CodUint8:  1|hasData|ack后面是否有数据|0,1|  
|
|CodUint8 : 1|eof|lob数据是否结束|0,1|  
|
|CodUint8 : 5|reserve|保留字|  
|  
|
|CodUint16 |unused|保留字|  
|  
|
|CodUint32 |dataLen|返回数据的长度|>= 0|  
|
|CodUint64|value|返回的值|>= 0|  
|
|CsLobLocator|locator|lob的CsLobLocator|合法的CsLobLocator|  
|


## 二、被使用场景

## 三、接收发送流程

![](https://conf.yasdb.com/download/attachments/68294902/image2023-2-28_15-43-20.png?version=1&modificationDate=1677570200000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgyMzEsImV4cCI6MTc4MjMxOTAzMX0.Ftosb_gvx6a_846iVpG13E_jKCcl5KrP2bASNMqNT0A)

## 四、异常场景排查拦截

1. reqLob的locLen 大于80则报错
1. 对于不同版本的lob协议对支持的功能进行拦截


## 五、跨包支持情况

在req的时候，isStream为1，开启流式传输的时候，支持流模式的跨包传输数据

在ack的时候，不支持跨包传输数据。

## 六、anlStmt相关字段

无相关字段

## 七、完成情况