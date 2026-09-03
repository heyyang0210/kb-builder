Created by 未知用户 (liaofeng), last modified by  邓秋怡 on 十月 18, 2023

#   [UTL_FILE.FGETPOS方案设计](#utl-filefgetpos方案设计)  

SR链接：

  [YDBRD-21680](https://jira.yasdb.com/browse/YDBRD-21680?src=confmacro)    -  高级包UTL_FILE新增FGETPOS子函数  完成

  


##   [1. Overview（概述）](#1-overview概述)  

UTL_FILE.FGETPOS是文件操作高级包UTL_FILE下的一个子函数，用于获取打开的file的文件指针所在的字节偏移位置。

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 Syntax（语法）](#21-syntax语法)  

```
UTL_FILE.FGETPOS (
	file IN FILE_TYPE)   
RETURN INTEGER;

```

###   [2.2 Parameter（参数）](#22-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|file|IN|FILE_TYPE|是|-|文件句柄，只可以为FILE_TYPE类型|


|入参|执行结果|
|---|---|
|缺省|报错，arguments count must be 1|
|null|报错，ERR_CMM_INVALID_FILETYPE（执行）|
|非fileType|报错，ERR_CMM_INVALID_FILETYPE（编译）|
|fileType，未初始化|报错，ERR_CMM_INVALID_FILETYPE|
|fileType，已初始化但状态为closed|报错，ERR_CMM_INVALID_FILETYPE|
|fileType，已初始化且状态为open，但打开模式为二进制（b）打开|（yas暂不支持二进制打开模式，所以暂时不会在fgetpos中出现此错误。）|
|fileType，已初始化且状态为open，且打开模式非b类型打开|返回打开的file的文件指针所在的偏移位置（字节位置）|


###   [2.3 返回值](#23-返回值)  

INTEGER类型，返回输入file的文件指针所在的偏移位置。

###   [内置异常](#内置异常)  

1. **INVALID_FILEHANDLE**    
  fgetpos未打开或未被赋值的文件句柄
1. **INVALID_OPERATION**    
  当文件的打开模式是二进制打开的（yas暂不支持二进制打开模式，所以暂时不会在fgetpos中出现此错误。）
1. **READ_ERROR**    
  目标缓冲区太小，或在读取操作期间发生操作系统错误（目前无法构建报错场景）


##   [3. Interfaces（接口）](#3-interfaces接口)  

CodResult bipVerifyFgetPos(AnlVerifier* vrfr, ExprNode* node)    
  CodResult bipConcludeFgetPos(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)    
  CodResult bipExecFgetPos(AnlStmt* stmt, ExprNode* node, Variant* retValue)

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 只支持单机和集群（暂不支持分布式）。
- 返回值为INTEGER类型，如果偏移位置大于int最大值，会翻转为负值（验证oracle的结果也是如此）。
- 文件支持a,w,r方式打开，r方式正确返回偏移位置，a\w方式返回0。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

1. 校验入参file的合法性
1. 通过utlFileNodeSearch函数查找对应的UtlFileNode
1. 返回UtlFileNode->readOffset


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

**UtlFileNode数据结构**

```
typedef struct StUtlFileNode {
CodBytes writeLineBuffer;
CodBytes readLineBuffer;
CodInt32 fileHandle;
CodUint32 maxLineSize;
CodInt64 readOffset;
CodInt32 lineFlushedSize;
CodUint32 fileType;
CodUint32 openMode;
CodUint32 createNum;
struct StUtlFileNode* next;
} UtlFileNode;

```

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1、常规测试：边读边fgetpos    
  2、参数测试：空、显式NULL、类型不匹配、类型匹配但未初始或未open等。    
  3、异常捕获    
  4、文件打开模式：w/a/r/三种情况下fgetpos的值。【b相关的打开模式yas暂不支持】    
  5、fgetpos边界值测试【32位直接截断】    
  6、读写同时打开一个文件，读写handle各不影响。    
  7、手动赋值id和dataType的handle，再用此handle去fgetpos，手动赋值的Handle只有id和dataType都正确，才可以正常fgetpos偏移位置。    
  【详见    [UTL_FILE.FGETPOS调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=133562889)    】

##   [7. Document（资料）](#7-document资料)  

  [Oracle Database 19c UTL_FILE文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/UTL_FILE.html#GUID-AAC3D50B-8934-466D-B431-B22C97A4A31E)  

##   [8. Workload（工作量）](#8-workload工作量)  

工作量1周

##   [9. TODO（遗留问题）](#9-todo遗留问题)  