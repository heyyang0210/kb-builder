Created by 侯忠林, last modified on 三月 26, 2024

  [协议支持调试器 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95095814)  

## 一、协议格式

### REQ：

和CMD_DEBUG协议一起配合修改的还有CMD_EXECUTE协议，在CMD_EXECUTE中新增关键字isDebug

reqExecute

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint8 : 1|isDebug|是否是debug的标记位|0,1|  
|


CMD_DEBUG协议的请求协议结构为：reqDebug+body

reqDebug部分

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint16|stmtId|  
|合法的stmtId|  
|
|CodUint8|debugCmd|调试器协议的命令字|- DBG_CMD_START
- DBG_CMD_CONTINUE
- DBG_CMD_STEP_INTO
- DBG_CMD_STEP_NEXT
- DBG_CMD_STEP_OUT
- DBG_CMD_ABORT
- DBG_CMD_ADD_BP
- DBG_CMD_DEL_BP
- DBG_CMD_SHOW_VARS
- DBG_CMD_SHOW_FRAMES
- DBG_CMD_CHECK_VERSION
|  
|
|CodUint8|unused|保留字|0|  
|
|CodUint32|reqLen|请求的数据长度|  
|  
|
|CodUint32|reserved|保留字|0|  
|


body部分根据不同debugCmd命令分为以下三种：

|debugCmd|body|
|---|---|
|DBG_CMD_START,DBG_CMD_CONTINUE,DBG_CMD_STEP_INTO,DBG_CMD_STEP_NEXT,DBG_CMD_STEP_OUT,DBG_CMD_ABORT,DBG_CMD_SHOW_VARS,DBG_CMD_SHOW_FRAMES|NULL|
|DBG_CMD_CHECK_VERSION|objectid（uint64）+ subId(uint16) + version(uint32)|
|DBG_CMD_ADD_BP   |objectid（uint64）+ subId(uint16) + lineNum(uint32)|
|DBG_CMD_DEL_BP|breakpointId（uint32）|


### ACK：

ack部分有一次升级有两个版本

#### 版本一：

ack包分三个部分  AckDebug+MetaData+Data

MetaData和data绑定数据，有data一定有MetaData数据，如果有多个则为MetaData+Data+MetaData+Data+MetaData+Data......

AckDebug：

|类型|名称|描述|合法值|边界值|
|---|---|---|---|---|
|CodUint8|debugCmd|调试器协议的命令字|- DBG_CMD_START
- DBG_CMD_CONTINUE
- DBG_CMD_STEP_INTO
- DBG_CMD_STEP_NEXT
- DBG_CMD_STEP_OUT
- DBG_CMD_ABORT
- DBG_CMD_ADD_BP
- DBG_CMD_DEL_BP
- DBG_CMD_SHOW_VARS
- DBG_CMD_SHOW_FRAMES
- DBG_CMD_CHECK_VERSION
|  
|
|CodUint8|debugStatus|调试器状态|- DBG_OFF
- DBG_ON   
- DBG_IGNORE_BP （预留）
|  
|
|CodUint16|unused|保留字|  
|  
|
|CodUint32|varCount|data数据个数|>= 0|0|


格式化MetaData:

DebugVarInfo;

|varNo(uint32)|||
|:---:|---|---|
|isGlobal(uint8)|unused(uint8)|subId(uint16)|
|objectId(uint64)|||
|lineNo(uint32)|||
|CsColumnDesc   |||


CsColumnDesc ：

|id(uint16)||size(uint16)||
|:---:|---|:---:|---|
|type(uint8)|precision(uint8)|scale(uint8)|flag(uint8)|
|nameLen(uint8)|nameStr(nameLen*8)|||


数据 Data: size + value

返回报文一共分一下几种场景：    
  1 返回Debug状态和当前运行状态objectId subId和行号；[AckDebug]+[MetaData]+[Data] ，MetaData里有objectId subId，行号在Data里    
  2 添加断点情况只返回一个 int值的value；[AckDebug]+[MetaData]+[Data] ，MetaData为一个空数据，value在Data里    
  3 N个调试变量信息；[AckDebug]+[MetaData]+[Data] +[MetaData]+[Data] +[MetaData]+[Data] ...    
  4 N个堆栈信息; [AckDebug]+[MetaData]+[Data] +[MetaData]+[Data] +[MetaData]+[Data] ...

|AckDebug|||MetaData||data|
|:---:|---|---|:---:|---|---|
|debugCmd|debugStatus|varCount|DebugVarInfo|CsColumnDesc||
|DBG_CMD_START,DBG_CMD_CONTINUE,DBG_CMD_STEP_INTO,DBG_CMD_STEP_NEXT,DBG_CMD_STEP_OUT|  
,  
,DBG_ON|  
,  
,1|  
,  
,subId+objectId|  
,  
,CodUint32|  
,  
,sizeof（CodUint32） + lineNo|
|DBG_CMD_ADD_BP   |DBG_ON|1|0|CodUint32|sizeof（CodUint32） + breakpointId|
|DBG_CMD_SHOW_VARS|DBG_ON|N|blockNo(varNo)+isGlobal|varType+varNameLen+varName|sizeof（varType） + var|
|DBG_CMD_SHOW_FRAMES|DBG_ON|N|blockNo(varNo)+lineNo|CodText+classNameLen+className|sizeof（methodNameLen） + methodName|
|DBG_CMD_CHECK_VERSION,DBG_CMD_DEL_BP|DBG_ON|0|0|0|0|


#### 版本二

请求报文没有修改部分，但是去除了CHECK_VERSION必须是第一个debug报文的强制校验，协议不要求首先必须进行版本号的检验。

响应报文格式修改：

响应报文头  AckDebug没有修改部分

响应报文体改为[AckDebug]+[Data]  源报文中MetaData部分和Data数据整合一起，去除冗余字段，全部一起作为data发送。

返回报文一共分一下几种场景：

|场景|AckDebug|||data|报文|跨包|
|:---:|:---:|---|---|:---:|:---:|:---:|
||debugCmd|debugStatus|varCount||||
|返回Debug状态和当前运行状态objectId subId和行号|DBG_CMD_START,DBG_CMD_CONTINUE,DBG_CMD_STEP_INTO,DBG_CMD_STEP_NEXT,DBG_CMD_STEP_OUT|  
,  
,DBG_ON|  
,  
,1|  
,  
,  
,DebugFrameInfo|  
,  
,  
,AckDebug+DebugFrameInfo|  
,  
,  
,不会跨包|
|返回一个 int值的value|DBG_CMD_ADD_BP|DBG_ON|1|breakpointId|AckDebug+breakpointId|不会跨包|
|不返回data数据|DBG_CMD_DEL_BP,DBG_CMD_CHECK_VERSION|DBG_ON|0|NULL|AckDebug|不会跨包|
|返回N个调试变量信息|DBG_CMD_SHOW_VARS|DBG_ON|N|N*(DebugVariantInfo + Variant)|AckDebug+DebugVariantInfo+varLen+var,+DebugVariantInfo+varLen+var……|DebugVariantInfo会整个跨包,var可能会跨包|
|返回N个堆栈信息|DBG_CMD_SHOW_FRAMES|DBG_ON|N|N*DebugFrameInfo|AckDebug+DebugFrameInfo+DebugFrameInfo……|DebugFrameInfo会整个跨包|


DebugRunInfo:

|objectId(uint64)||
|:---:|---|
|subId(uint16)|unused(uint16)|
|lineNo(uint32)||
|stackNo(uint32)||


堆栈信息：DebugFrameInfo

|DebugRunInfo||||
|:---:|---|---|---|
|unused(uint8*2)||classNameLen(uint8)|methodNameLen(uint8)|
|className(classNameLen*uint8)||||
|methodName(methodNameLen*uint8)||||


变量信息：DebugVariantInfo

|DebugRunInfo||||
|:---:|---|---|---|
|blockNo(uint32)||||
|type(uint8)|isGlobal(uint8)|unused(uint8*5)|nameLen(uint8)|
|name(nameLen*uint8)||||


## 二、被使用场景

在调试存储过程或者函数的时候，可以通过debug协议中的命令和查遍变量和堆栈信息，去调试存储过程或者函数是否是自己期望的。

## 三、接收发送流程

![](https://conf.yasdb.com/download/attachments/95095814/screen_shot_1675682358407.png?version=2&modificationDate=1709263778000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDgxMTEsImV4cCI6MTc4MjMxODkxMX0.SZegy6PInimSq7dWSfvvKazTV5jp6P_H2KRUYIC12bo)

|  
,操作|请求报文（协议）||返回报文（协议）    
    
    
|||
|---|:---:|---|:---:|---|---|
||reqExecute|reqDebug|ackExecute|ackDebug|ackReturnResult|
|开始调试模式|CMD_EXECUTE|  
|  
|DBG_CMD_START|  
|
|检查版本号|  
|DBG_CMD_CHECK_VERSION|  
|DBG_CMD_CHECK_VERSION|  
|
|增加断点|  
|DBG_CMD_ADD_BP|  
|DBG_CMD_ADD_BP|  
|
|删除断点|  
|DBG_CMD_DEL_BP|  
|DBG_CMD_DEL_BP|  
|
|查看变量|  
|DBG_CMD_SHOW_VARS|  
|DBG_CMD_SHOW_VARS|  
|
|查看堆栈|  
|DBG_CMD_SHOW_FRAMES|  
|DBG_CMD_SHOW_FRAMES|  
|
|步进模式|  
|DBG_CMD_STEP_INTO|CMD_EXECUTE|DBG_CMD_STEP_INTO|CMD_RETURN_RESULT|
|执行完当前方法|  
|DBG_CMD_STEP_OUT|CMD_EXECUTE|DBG_CMD_STEP_OUT|CMD_RETURN_RESULT|
|继续执行|  
|DBG_CMD_CONTINUE|CMD_EXECUTE|DBG_CMD_CONTINUE|CMD_RETURN_RESULT|
|执行下一行|  
|DBG_CMD_STEP_NEXT|CMD_EXECUTE|DBG_CMD_STEP_NEXT|CMD_RETURN_RESULT|
|中断调试器模式|  
|DBG_CMD_ABORT|CMD_EXECUTE|  
|  
|


## 四、异常场景排查拦截

1. reqExecute中的isDebug标志位只有在anrExecute中生效，其他的都不生效。
1. reqDebug中的reqLen长度必须和发送的数据长度一致，否则报错。
1. ackDebug中的  debugCmd必须和发送的debugCmd一致。
1. reqDebug和ackDebug中对debugCmd有范围校验。


## 五、跨包支持情况

reqDebug不支持跨包，因为目前数据较小

ackDebug支持跨包,对应命令字如下：

|版本|debugCmd|跨包|
|---|---|---|
|版本一|DBG_CMD_START,DBG_CMD_CONTINUE,DBG_CMD_STEP_INTO,DBG_CMD_STEP_NEXT,DBG_CMD_STEP_OUT|不会跨包|
||DBG_CMD_ADD_BP   |不会跨包|
||DBG_CMD_SHOW_VARS|DebugVarInfo和data会跨包|
||DBG_CMD_SHOW_FRAMES|DebugVarInfo和data会跨包|
||DBG_CMD_CHECK_VERSION,DBG_CMD_DEL_BP|不会跨包|
|版本二|DBG_CMD_START,DBG_CMD_CONTINUE,DBG_CMD_STEP_INTO,DBG_CMD_STEP_NEXT,DBG_CMD_STEP_OUT|  
,  
,  
,不会跨包|
||DBG_CMD_ADD_BP|不会跨包|
||DBG_CMD_DEL_BP,DBG_CMD_CHECK_VERSION|不会跨包|
||DBG_CMD_SHOW_VARS|DebugVariantInfo会整个跨包,var可能会跨包|
||DBG_CMD_SHOW_FRAMES|DebugFrameInfo会整个跨包|


## 六、anlStmt相关字段

不涉及

## 七、完成情况