Created by 冯皓博, last modified on 三月 22, 2024

## 一、协议格式

### REQ：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtId|  
|合法的stmtId|  
|
|CodUint8:  1|autoCommit|自动提交|  
|  
|
|CodUint8 : 1|outputOn|CMD_OUTPUT是否注册回调|  
|  
|
|CodUint8 : 1|dmlRow|进入batch execute模式，这种模式支持容错，支持返回批量插入中的错误|  
|  
|
|CodUint8 : 1|batchError|ackExecute是否返回批量插入产生的批量错误，前提是dmlRow为true|  
|  
|
|CodUint8 : 3|autoTrace|autotrace|typedef enum EnAutotStatus {    
  AUTO_TRACE_OFF = 0, // only result    
  AUTO_TRACE_ONLY_STAT, // only result    
  AUTO_TRACE_ONLY_EXP, // only result    
  AUTO_TRACE_EXP_STAT, // exp, stat    
  AUTO_TRACE_ONLY_RES, // only res, actually equals to AUTO_TRACE_OFF    
  AUTO_TRACE_RES_STAT, // result, stat    
  AUTO_TRACE_RES_EXP, // result, exp    
  AUTO_TRACE_ON, // result, exp, stat    
  } AutotStatus;,0-7|  
|
|CodUint8 : 1|isDebug|是否开启调试|  
|  
|
|CodUint8|reserved|保留字|  
|  
|
|CodUint16|paramCount|参数个数|  
|  
|
|CodUint16|paramsetSize|批量执行行数，16位不够用，需要扩展成32位？|  
|  
|
|CodUint32|prefetchSize|预取行数，是ackexecute后带的结果集行数,默认为0，如果设为0：到服务端后修改为10。,如果不为0，实际生效。|  
|  
|


+

if（paramCount > 0）{

while（param元数据未发完）{

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint8|paramDataType|参数数据类型|DTYPE_XXX|  
|
|CodUint8|paramDirection|参数方向|typedef enum EnYacParamDirection {    
  YAC_PARAM_INPUT = 1,    
  YAC_PARAM_OUTPUT = 2,    
  YAC_PARAM_INOUT = 3,    
  } YacParamDirection;|  
|


}

}

+

if（paramCount > 0）{

while（行绑定参数未发完）{

while（当前列参数未发完）{

**length+value形式**

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|二进制数据|二进制数据|  
|  
|  
|


}

}

}

+

if（流数据 > 0）{

while（行绑定参数未发完）{

while（当前列参数未发完）{

while（当前格参数未发完）{

**length+value形式**

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|二进制数据|二进制数据|  
|  
|  
|


}

}

}

}

### ACK：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint32|batchRows|当前报文包含结果集行数|0-10|  
|
|CodUint16|outParams|出参个数|  
|  
|
|CodUint16|marginColumns|当前截断列序号|  
|  
|
|CodUint64 : 40|affectedRows|DML影响行数|  
|  
|
|CodUint64 : 2|xactStatus|当前事务状态|  
|  
|
|CodUint64 : 2|xisoLevel|当前事务隔离级别|  
|  
|
|CodUint64 : 1|hasMoreRows|当前报文后是否还有结果集|  
|  
|
|CodUint64 : 1|hasBatchRows|不明就里，reqExecute->dmlRow为true，这个肯定为true|  
|  
|
|CodUint64 : 1|hasBatchError|是否有批量插入错误产生|  
|  
|
|CodUint64 : 17|unused|保留字|  
|  
|


+

if（outParams > 0）{

while（出参数据没读完）{

**length+value形式**

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|二进制数据|二进制数据|  
|  
|  
|


}

}

+

if（hasBatchRows）{

**length+value形式**

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint32|batchRowsSize|当前批量插入行数|  
|  
|


+

**length+value形式**

while（没到batchRowsSize）{

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint32|行号|当前插入行号|  
|  
|


}

+

if（hasBatchError）{

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint32|errorsSize|当前错误数|  
|  
|


}

+

错误信息（未展开，此处有BUG）

yacGetAckBatchErrors

}

}

}

+

while（没到batchRows）{

**length+value形式**

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|二进制数据|二进制数据|  
|  
|  
|


}

## 二、被使用场景

anrExecute

## 三、接收发送流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d6ba1ad9a3311dc90fc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFRQUVBQUFBQUFJQUFBQUFBQUFDQkFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFJQUFBZ0FBQUFBQUFFQ0Fpd0FBQUFBUUFBQWdBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxNjIsImV4cCI6MTc4MjMxODk2Mn0.AEVRGfSiA5SyhOopeeDbtiiyFK7icdNW0LQe2O8zjFk)

1、此处产生回写操作，在跨包情况下可能产生BUG，同时未考虑跨包场景

![](https://pingcode.yasdb.com/atlas/files/public/67396d6b8970c2af4f521289/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFRQUVBQUFBQUFJQUFBQUFBQUFDQkFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFJQUFBZ0FBQUFBQUFFQ0Fpd0FBQUFBUUFBQWdBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxNjIsImV4cCI6MTc4MjMxODk2Mn0.AEVRGfSiA5SyhOopeeDbtiiyFK7icdNW0LQe2O8zjFk)

2、yacGetAckBatchErrors设计不合理，在yacGetStmtAttr时才读报文信息，需要整改

3、batch相关标记位+名称混乱，需要统一名称：

req：dmlRow、batchError

ack：hasBatchRows、hasBatchError

4、anrReadBindings有回读场景，这块是否没有意义

![](https://pingcode.yasdb.com/atlas/files/public/67396d6ba1ad9a3311dc90fd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFRQUVBQUFBQUFJQUFBQUFBQUFDQkFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFJQUFBZ0FBQUFBQUFFQ0Fpd0FBQUFBUUFBQWdBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxNjIsImV4cCI6MTc4MjMxODk2Mn0.AEVRGfSiA5SyhOopeeDbtiiyFK7icdNW0LQe2O8zjFk)

5、anrSendExecEnd有回写场景，这块是否修正

![](https://pingcode.yasdb.com/atlas/files/public/67396d6b8970c2af4f52128a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFRQUVBQUFBQUFJQUFBQUFBQUFDQkFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFJQUFBZ0FBQUFBQUFFQ0Fpd0FBQUFBUUFBQWdBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxNjIsImV4cCI6MTc4MjMxODk2Mn0.AEVRGfSiA5SyhOopeeDbtiiyFK7icdNW0LQe2O8zjFk)

  


## 四、异常场景排查拦截

1、对于已free的stmt检查不全面

2、对于stmt的status检查不全面

3、在所有该读完报文的时候检查报文已读完

  


## 五、跨包支持情况

1、参数数据做了跨包处理，但是是否需要优化？

2、batch相关逻辑未做跨包处理

  


## 六、anlStmt相关字段

  


## 七、完成情况

  


## Attachments:

[image2024-3-19_20-9-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmI4OTcwYzJhZjRmNTIxMjg2IiwicmVmX2lkIjoiNjczOTZkNmI1OTNmOTljOWZmMjM3YjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MTYyLCJleHAiOjE3ODIzOTQ1NjJ9.H89-C7MDnydQmSbwNzgC4T9hirVH3xHGERl_F2Y9iBQ)

 (image/png)    


[image2024-3-20_11-48-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmI4OTcwYzJhZjRmNTIxMjg3IiwicmVmX2lkIjoiNjczOTZkNmI1OTNmOTljOWZmMjM3YjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MTYyLCJleHAiOjE3ODIzOTQ1NjJ9.F7gG3CvX-3QAGHQRLf8GKKnHlMp3quBZgZaGrfqyxts)

 (image/png)    


[image2024-3-20_15-12-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNmJhMWFkOWEzMzExZGM5MGZhIiwicmVmX2lkIjoiNjczOTZkNmI1OTNmOTljOWZmMjM3YjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4MTYyLCJleHAiOjE3ODIzOTQ1NjJ9.nIRvaqe1jXUGJaE7PbUkHzSeU3Yf778cTVz7atxCjMw)

 (image/png)    
