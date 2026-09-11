Created by 未知用户 (liaofeng), last modified on 十一月 14, 2023

##   [1. Overview（概述）](#1-overview概述)  

对标oracle的DBMS_UTILITY高级包能力

1. **FORMAT_ERROR_STACK**  返回当前的error stack格式化输出，可以用于在异常处理模块查看整个error stack信息
1. **FORMAT_CALL_STACK**  返回当前call stack（plsql函数调用栈）的格式化输出。用于任何stored procedure或触发器中去获取call stack


##   [2. Features（功能特性）](#2-features功能特性)  

1. **语法**


**FORMAT_ERROR_STACK:**

```
DBMS_UTILITY.FORMAT_ERROR_STACK 
  RETURN VARCHAR2;

```

**FORMAT_CALL_STACK:**

```
DBMS_UTILITY.FORMAT_CALL_STACK 
  RETURN VARCHAR2;

```

1. **功能**


3.  **返回值**    
  **FORMAT_ERROR_STACK:**    
  返回当前error stack的格式化输出，最大2000字节。

**FORMAT_CALL_STACK:**    
  返回当前call stack的格式化输出，最大2000字节。

##   [3. Interfaces（接口）](#3-interfaces接口)  

static CodResult bipVerifyFormatCallStack(AnlVerifier* vrfr, ExprNode* node)    
  static CodResult bipConcludeFormatCallStack(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)    
  static CodResult bipExecFormatCallStack(AnlStmt* stmt, ExprNode* node, Variant* retValue)    
  static CodResult bipVerifyFormatErrorStack(AnlVerifier* vrfr, ExprNode* node)    
  static CodResult bipConcludeFormatErrorStack(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)    
  static CodResult bipExecFormatErrorStack(AnlStmt* stmt, ExprNode* node, Variant* retValue)

static CodVoid getCallStackFrameObjectType(SoFrame* frame, CodUint8* type)    
  static CodResult getCallStackFrameObjectName(AnlStmt* stmt, SoFrame* frame, CodText* objectName)    
  static CodResult getFormatNonCallStackText(AnlStmt* stmt, CodText* text, CodUint32 offset)    
  static CodResult soGetFormatCallStackText(AnlStmt* stmt, CodText* text)

CodVoid anlSoInitErrMsgStack()    
  CodVoid soResetErrMsgStack()    
  CodVoid soSetErrMsgStack()    
  CodResult soGetErrMsgStackFormatText(AnlStmt* stmt, CodText* text)    
  CodVoid soPushErrMsgStack(CodUint32* len)    
  CodVoid soPopErrMsgStack(CodUint32 len)

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

**FORMAT_ERROR_STACK:**

1. 在存在执行错误的情况下输出错误信息，否则输出null。
1. 存在多个错误时，例如exception嵌套或者调用plsql对象，错误信息依次入栈，输出时按先进后出的次序（出栈次序）依次输出错误信息，用换行符分隔，最后一个错误信息也会输出一个换行符
1. 使用超过2000个字节的errMsg，输出截断，入股回退栈帧时会恢复被截断的内容（buf大小为4000）
1. 调用存储过程或自定义函数时，存储过程或自定义函数内部的error stack会在退出调用时退栈
1. 使用raise_application_error生成异常会清空之前的error stack，设置为raise_application_error的错误信息，后续可以继续入栈新的错误信息，但在存储过程调用结束后，error stack不会恢复调用前的栈帧，而是为清空状态，且清空状态会向调用栈的外层传染。
1. 普通的用户自定义异常与系统错误处理逻辑一致


**FORMAT_CALL_STACK:**

1. 输出四列信息，object handle为对象内存地址，line number为行号，object对象类型（普通sql语句显示anonymous，trigger不显示），name对象名称，包含schema，对于package或type的子过程体还包含package或type名字和子过程体名字，package的init section输出为schema.packName.__pkg_ini。oracle输出格式较为混乱
1. 能在在任何stored procedure中使用，以及匿名块和普通sql语句中使用，普通sql语句输出对象为anonymous block
1. 超过2000个字节时截断后面的内容
1. 如果是非so sql或so中的sql语句调用format_error_stack，此时补充输出一个anonymous，
1. 如果是so中sql语句再调用过程体，被调用的过程体内调用format_error_stack，并不会输出sql语句的栈帧。
1. 对于job这种内置高级包调用的过程体中使用的format_error_stack，并不会显示内置高级包的调用栈（与oracle有差异，oracle的内置高级包也是使用package实现的，我们内置高级包类似于内置函数实现）
1. 对于call procedure。oracle的call语句不当作anonymous，我们等同于anonymous。


reset状态迁移

![](https://pingcode.yasdb.com/atlas/files/public/67396a2da1ad9a3311dc7b5b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNCQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1MzgsImV4cCI6MTc4MjIyMjMzOH0.hYN1TLKkh0370Msr56FhHvao_lhqrKEmd5uSvgrZWbs)

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [a.FORMAT_CALL_STACK](#aformat-call-stack)  

1. 主体上复用之前调试器实现的SoFrameStack保存执行的调用栈信息，修改为在soExec阶段执行开始前使用soPushFrame保存栈帧，执行结束后使用soPopFrame回退栈帧。只保存过程体调用的栈帧
1. 调用format_error_stack时通过遍历SoFrameStack，获取每一层调用栈的信息，组成最后格式化输出的format call stack text
1. 如果是非so sql调用format_call_stack，此时输出一个anonymous
1. 如果是so中的sql语句调用format_call_stack，由于并不会保存sql语句的栈帧，所以通过判断当前context不为SO CONTEXT判断，此时输出添加一个anonymous调用
1. 如果是so中sql语句再调用过程体，被调用的过程体内调用format_error_stack，并不会输出sql语句的栈帧。


###   [a.FORMAT_ERROR_STACK](#aformat-error-stack)  

1. 定义一个结构体，buf作为输出结果的内存区域。exception嵌套时新的错误信息加到buf的头部。
1. 如果执行到raise_application_error，使用soResetErrMsgStack清空buf，并设置currReset和gSoErrMsgStack.cleanFlags[gSoErrMsgStack.depth]为True。
1. 如果是执行过程体函数，执行前使用preErrStackLen保存当前msg长度，使用soPushErrMsgStack入栈，设置depth++，currCleanFlag和gSoErrMsgStack.cleanFlags[gSoErrMsgStack.depth]为false；执行后恢复利用preErrStackLen恢复原msg，使用soPopErrMsgStack，同时如果在pop时,currCleanFlag或gSoErrMsgStack.cleanFlags[gSoErrMsgStack.depth]为true，向上层传染cleanFlag。
1. 调用format_err_stack时使用soGetErrMsgStackFormatText获取errMsgStack中保存的错误信息


###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

```

typedef struct StSoErrMsgStack {
    CodChar   buf[SO_ERR_MSG_STACK_BUF_SIZE];
    CodUint32 currReset;
} SoErrMsgStack;


```

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments: