Created by 侯忠林, last modified on 六月 14, 2024

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

目前外场需要C驱动支持存储过程调试器功能，便于C数据库工具开发支持存储过程的调试。

  [协议支持调试器 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95095814)  

  [协议支持调试器(版本2) - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147770957)  

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持功能：

启动调试器，增加断点，查看断点，删除断点，终止调试器，步进模式，下一步，继续执行，退出当前执行方法，查看变量，查看堆栈，校验版本号。

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

|接口|说明|
|:---|:---|
|YacResult yacPdbgStart(YacHandle stmt)|启动调试器|
|YacResult yacPdbgCheckVersion(YacHandle hStmt, YacUint64 objId, YacUint16 subId, YacUint32 version)|校验版本号|
|YacResult yacPdbgAbort(YacHandle stmt)|终止调试器|
|YacResult yacPdbgContinue(YacHandle stmt)|继续执行|
|YacResult pdbgStepInto(YacHandle stmt)|步进模式|
|YacResult yacPdbgStepOut(YacHandle stmt)|退出当前执行方法|
|YacResult yacPdbgStepNext(YacHandle stmt)|下一步|
|YacResult yacPdbgGetAllVars(YacHandle stmt， YacUint32* varCount)|查看变量|
|YacResult yacPdbgGetAllFrames(YacHandle stmt， YacUint32* frameCount)|查看堆栈|
|YacResult yacPdbgDeleteAllBreakpoints(YacHandle stmt)|删除所有断点|
|YacResult yacPdbgAddBreakpoint(YacHandle stmt, YacUint64 objId, YacUint16 subId, YacUint32 lineNum, YacUint32* bpId)|增加断点|
|YacResult yacPdbgDeleteBreakpoint(YacHandle stmt, YacUint64 objId, YacUint16 subId, YacUint32 lineNum)|删除断点|
|YacResult yacPdbgGetBreakpointsCount(YacHandle stmt, YacUint32* bpCount)|查看断点|
|YacResult yacPdbgGetRunningAttrs(YacHandle hStmt， YacDebugRunningAttr attr, YacPointer value, YacInt32 bufLen, YacInt32* stringLength)|获取当前运行状态信息,  
|
|YacResult yacPdbgGetFrameAttrs(YacHandle hStmt， YacUint32 id, YacDebugFrameAttr attr, YacPointer value, YacInt32 bufLen, YacInt32* stringLength)|获取堆栈信息|
|YacResult yacPdbgGetVarAttrs(YacHandle hStmt， YacUint32 id, YacDebugVarAttr attr, YacPointer value, YacInt32 bufLen, YacInt32* stringLength)|获取变量信息|
|YacResult yacPdbgGetVarValue(YacHandle hStmt，YacUint32 id, YacUint32 valueType, YacPointer value, YacInt32 bufLen, YacInt32* indicator)|获取变量值信息|
|YacResult yacPdbgGetBreakpointAttrs(YacHandle hStmt， YacUint32 id, YacDebugBpAttr attr, YacPointer value, YacInt32 bufLen, YacInt32* stringLength    
  )|获取断点信息|


  


##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

无。

  


##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

|接口|参数|校验|实现|
|---|---|---|---|
|YacResult yacPdbgStart(YacHandle stmt)|stmt 当前执行的stmt|debug正在运行报错，debug is running|1. 直接执行带有debug标志位的execute操作
1. 返回CMD_DEBUG的返回报文，解析当前堆栈信息runningInfo，并挂在stmt上。
1. 发送所有在debug启动之前设置的断点，请求对应的bpId。
|
|YacResult yacPdbgCheckVersion(YacHandle hStmt, YacUint64 objId, YacUint16 subId, YacUint32 version)|stmt 当前执行的stmt|  
    
    
    
    
    
    
    
    
    
    
    
  只有debug正在运行才会返回信息，否则报错debug is not running    
    
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
|将objId，subId，version发给服务端校验，校验异常则返回error|
|YacResult yacPdbgAbort(YacHandle stmt)|stmt 当前执行的stmt||1. 如果debug正在运行，直接发送abort命令字给服务端，校验返回的CMD_EXECUTE返回报文
1. 如果debug未运行，直接返回success
|
|YacResult yacPdbgContinue(YacHandle stmt)|stmt 当前执行的stmt||1. 直接发送对应命令字
1. 返回CMD_DEBUG的返回报文，解析当前堆栈信息runningInfo，并挂在stmt上。
1. 返回CMD_EXECUTE则解析execute的结果信息，并退出debug模式，清除stmt上相关的所有debug信息。
,  
    
    
|
|YacResult yacPdbgStepInto(YacHandle stmt)|stmt 当前执行的stmt|||
|YacResult yacPdbgStepOut(YacHandle stmt)|stmt 当前执行的stmt|||
|YacResult yacPdbgStepNext(YacHandle stmt)|stmt 当前执行的stmt|||
|YacResult yacPdbgGetAllVars(YacHandle stmt， YacUint32* varCount)|1. stmt 当前执行的stmt
1. varCount(出参) 变量个数
||1. 发送CMD_DEBUG对应命令字给服务端
1. 解析返回的报文，将所有的变量信息List挂在stmt上
1. 返回List对应的count
|
|YacResult yacPdbgGetAllFrames(YacHandle stmt， YacUint32* frameCount)|1. stmt 当前执行的stmt
1. frameCount(出参)堆栈个数
||1. 发送CMD_DEBUG对应命令字给服务端
1. 解析返回的报文，将所有的堆栈信息List挂在stmt上
1. 返回List对应的count
|
|YacResult yacPdbgDeleteAllBreakpoints(YacHandle stmt)|stmt 当前执行的stmt|  
|1. 如果debug没有运行则直接清除List上所有的断点
1. 遍历stmt上断点List的所有节点，如果有bpId的发送服务端删除
1. 清除List上所有的断点
|
|YacResult yacPdbgAddBreakpoint(YacHandle stmt, YacUint64 objId, YacUint16 subId, YacUint32 lineNum, YacUint32* bpId)|1. stmt 当前执行的stmt
1. objId，subId，lineNum断点信息
1. bpId(出参)断点全局id
|  
|1. 判断当前断点是否已经存在，已经存在则直接返回对应bpId
1. 如果debug模式没有运行则，直接在List上新增节点bpId返回COD_INVALID_UINT32
1. 如果当前在运行过程中，则给服务端发送数据请求全局bpId
|
|YacResult yacPdbgDeleteBreakpoint(YacHandle stmt, YacUint64 objId, YacUint16 subId, YacUint32 lineNum)|1. stmt 当前执行的stmt
1. objId，subId，lineNum断点信息
|  
|1. 校验断点是否存在
1. 如果debug模式没有运行则直接删除List对应节点
1. 如果当前在运行过程中，则给服务端发送数据请求删除
|
|YacResult yacPdbgGetBreakpointsCount(YacHandle stmt, YacUint32* bpCount)|1. stmt 当前执行的stmt
1. bpCount(出参) 断点个数
|  
|返回所有断点的个数|
|YacResult yacPdbgGetRunningAttrs(YacHandle hStmt， YacDebugRunningAttr attr, YacPointer value, YacInt32 bufLen, YacInt32* stringLength)|1. stmt 当前执行的stmt
1. YacDebugRunningAttr
1. debug_running_attr_status    
  debug_running_attr_objectId    
  debug_running_attr_subId    
  debug_running_attr_lineNo    
  debug_running_attr_className    
  debug_running_attr_methodName
1. value接收变量的指针
1. bufLen指针buff的大小
1. indicator是否为空值指示符
|  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,只有debug正在运行才会返回信息，否则报错debug is not running|将解析过后挂在stmt上的runningInfo信息，按照attr的类型返回|
|YacResult yacPdbgGetFrameAttrs(YacHandle hStmt， YacUint32 id, YacDebugFrameAttr attr, YacPointer value, YacInt32 bufLen, YacInt32* stringLength)|1. stmt 当前执行的stmt
1. YacDebugFrameAttr    
  debug_Frame_attr_objectId    
  debug_Frame_attr_subId    
  debug_Frame_attr_lineNo    
  debug_Frame_attr_stackNo    
  debug_Frame_attr_className    
  debug_Frame_attr_methodName
1. value接收变量的指针
1. bufLen指针buff的大小
1. indicator是否为空值指示符
||将解析过后挂在stmt上的堆栈信息，按照attr的类型返回|
|YacResult yacPdbgGetVarAttrs(YacHandle hStmt， YacUint32 id, YacDebugVarAttr attr, YacPointer value, YacInt32 bufLen, YacInt32* stringLength)|1. stmt 当前执行的stmt
1. YacDebugVarAttr    
  debug_Frame_attr_blockNo    
  debug_Frame_attr_type    
  debug_Frame_attr_isGlobal    
  debug_Frame_attr_name    
  debug_Frame_attr_value_size
1. value接收变量的指针
1. bufLen指针buff的大小
1. indicator是否为空值指示符
||将解析过后挂在stmt上的变量信息，按照attr的类型返回|
|YacResult yacPdbgGetVarValue(YacHandle hStmt，YacUint32 id, YacUint32 valueType, YacPointer value, YacInt32 bufLen, YacInt32* indicator)|1. stmt 当前执行的stmt
1. valueType 绑定value的数据类型
1. value接收变量的指针
1. bufLen指针buff的大小
1. indicator是否为空值指示符
||将变量对应的data通过不同的绑定类型，进行deCode，然后返回对应的值。|
|YacResult yacPdbgGetBreakpointAttrs(YacHandle hStmt， YacUint 32 id, YacDebugBpAttr attr, YacPointer value, YacInt32 bufLen, YacInt32* stringLength)|1. stmt 当前执行的stmt
1. YacDebugBpAttr    
  debug_Bp_attr_objectId    
  debug_Bp_attr_subId    
  debug_Bp_attr_lineNo
1. value接收变量的指针
1. bufLen指针buff的大小
1. indicator是否为空值指示符
|  
|将stmt上对应的断点信息按照attr的类型返回信息|


##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. yacPdbgStart能够正常的启动调试器模式并且返回的是CMD_DEBUG的报文
1. yacPdbgCheckVersion能够在启动调试器后通过传入version校验是否与当前版本一致
1. yacPdbgAbort能够正常中断debug模式，并退出debug模式
1. yacPdbgContinue能够正常执行到对应断点，或者直接到结束，并退出debug模式
1. yacPdbgStepInto能够正常的执行到当前行对应的方法中，如果没有方法，则执行当前行
1. yacPdbgStepOut能够正常退出当前方法，或者直接到结束，并退出debug模式
1. yacPdbgStepNext能够给执行当前行，或者直接到结束，并退出debug模式
1. yacPdbgGetAllVars能够获取当前变量的个数
1. yacPdbgGetVarData能够通过id获取变量对应的各个信息
1. yacPdbgGetVarValue能够获取目前支持的所有变量类型的数据
1. yacPdbgGetAllFrames能够获取当前堆栈的个数
1. yacPdbgGetFrameData能够给通过attr获取当前堆栈的信息
1. yacPdbgGetRunningData能够获取当前debug的运行所有的状态信息
1. yacPdbgDeleteAllBreakpoints能够删除所有的断点
1. yacPdbgAddBreakpoint能够添加新断点，如果在debug过程中则返回bpid，如果不在则返回COD_INVALID_UINT32，重复添加则返回的bpId一致
1. yacPdbgDeleteBreakpoint能够在运行执行和debug运行之后添加断点
1. yacPdbgGetBreakpointData能够获取断点的所有信息
1. 存储过程中dbms_sql.return_result，dbms_output.put_line能够正常运行
1. debug调试结束后能够获取正确的执行结果
1. 在debug执行过程中，执行其他非debug命令的交互则报错


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

  


  


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

无。