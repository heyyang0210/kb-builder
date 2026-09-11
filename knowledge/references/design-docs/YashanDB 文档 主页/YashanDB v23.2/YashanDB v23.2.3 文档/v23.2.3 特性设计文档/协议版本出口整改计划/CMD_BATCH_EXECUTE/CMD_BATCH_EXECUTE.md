Created by 贺国锋 on 三月 22, 2024

## 一、协议格式

### REQ：  ReqBatInsExecute

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtid|  
|  
|  
|
|CodUint16|isBulkLoad: 1    
  dedeuplicate: 1    
  reserved: 14|  
|  
|  
|
|CodU32|paramCnt|  
|  
|  
|
|CodUint64|partId|  
|  
|  
|


  


+ paramCount *   CsParamAttr + LV 数据

### ACK：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|


## 二、被使用场景

 yasldr batch模式下发送数据使用

  


## 三、发送接收流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d698970c2af4f521281/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgwNzksImV4cCI6MTc4MjMxODg3OX0.9_jNJAQDyYN1K8HbU_mFXnt83ByRKiYOAPvNXeAX9YI)

## 四、异常场景排查拦截

  


## 五、跨包支持情况

支持跨包

在发送阶段，每一个发送的数据包都是完整自洽的，都包含  ReqBatInsExecute，同一行数据不支持跨包，即每一个数据包包含完整的数据行。

在接受CMD_OUTPUT阶段，每一个数据包也都是完整自洽的，都包含完整的错误消息，一个数据行所涉及的错误消息不回跨包传输。

## 六、anlStmt相关字段

stmt->  attr  ->  paramCount

stmt->  attr  ->  isBulkLoad

stmt->  attr  ->  deduplicate

stmt->  attr  ->  ackExec  .  batInsPartNum

## 七、完成情况

  


## Attachments: