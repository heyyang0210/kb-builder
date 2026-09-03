Created by 冯皓博, last modified on 三月 21, 2024

## 一、协议格式

### REQ：

复用ReqExecute

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtId|  
|refCursor的stmtId|  
|
|CodUint8:  1|autoCommit|自动提交|（无用）|  
|
|CodUint8 : 1|outputOn|CMD_OUTPUT是否注册回调|（无用）|  
|
|CodUint8 : 1|dmlRow|进入batch execute模式，这种模式支持容错，支持返回批量插入中的错误|（无用）|  
|
|CodUint8 : 1|batchError|ackExecute是否返回批量插入产生的批量错误，前提是dmlRow为true|（无用）|  
|
|CodUint8 : 3|autoTrace|autotrace|（无用）|  
|
|CodUint8 : 1|isDebug|是否开启调试|（无用）|  
|
|CodUint8|reserved|保留字|（无用）|  
|
|CodUint16|paramCount|参数个数|（无用）|  
|
|CodUint16|paramsetSize|批量执行行数，16位不够用，需要扩展成32位？|（无用）|  
|
|CodUint32|prefetchSize|预取行数，是ackexecute后带的结果集行数,默认为0，如果设为0：到服务端后修改为10。,如果不为0，实际生效。|有用（没必要）|  
|


### ACK：

AckPrepare

+

AckExecute

+

列元数据

+

参数元数据

+

出参值

+

batch相关信息（批量插入情况+批量插入报错）

+

预取结果集 or stream结果集

## 二、被使用场景

![](https://pingcode.yasdb.com/atlas/files/public/67396d6ca1ad9a3311dc90ff/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFFQUFBQUFBQUFBSUFBQUFBQUlBQUVBQUFBQUNBQUFBQUFBUUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFFUUlCQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxOTcsImV4cCI6MTc4MjMxODk5N30.Z8T-Vv3l-jJMEmZsuz8YF103gExxznbfXCE2s7fefYA)

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d6c8970c2af4f52128e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFFQUFBQUFBQUFBSUFBQUFBQUlBQUVBQUFBQUNBQUFBQUFBUUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFFUUlCQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxOTcsImV4cCI6MTc4MjMxODk5N30.Z8T-Vv3l-jJMEmZsuz8YF103gExxznbfXCE2s7fefYA)

  


问题：

1、如果  CMD_EXECUTE产生跨包，同时读取ack报文时触发了CMD_FETCH_CURSOR，那么  可能会串包

所以CMD_FETCH_CURSOR的请求要后置，放到读取报文后，同时不能与流数据同时使用。

![](https://pingcode.yasdb.com/atlas/files/public/67396d6c8970c2af4f52128f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFFQUFBQUFBQUFBSUFBQUFBQUlBQUVBQUFBQUNBQUFBQUFBUUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFFUUlCQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxOTcsImV4cCI6MTc4MjMxODk5N30.Z8T-Vv3l-jJMEmZsuz8YF103gExxznbfXCE2s7fefYA)

2、req理论上最好复用ReqFetch的报文，本质是一次fetch

3、prefetchSize默认设为ANL_PARAM_PREFETCH_SIZE，将包填满

  


## 四、异常场景排查拦截

1、对于已free的stmt检查不全面

2、对于stmt的status检查不全面

anrFetchCursor前为什么是STMT_STATUS_FETCH状态？

当前SQL层只要完成execute就是fetch

![](https://pingcode.yasdb.com/atlas/files/public/67396d6c8970c2af4f521290/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFCQUFBQUFFQUFBQUFBQUFBSUFBQUFBQUlBQUVBQUFBQUNBQUFBQUFBUUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFFUUlCQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxOTcsImV4cCI6MTc4MjMxODk5N30.Z8T-Vv3l-jJMEmZsuz8YF103gExxznbfXCE2s7fefYA)

3、在所有该读完报文的时候检查报文已读完

## 五、跨包支持情况

1、列元数据、参数元数据（是否存在）、出参值（是否存在）跨包

2、batch相关信息跨包需要适配？

## 六、anlStmt相关字段

AnlStmtAttr->isFetchCursor

## 七、完成情况

  


## Attachments: