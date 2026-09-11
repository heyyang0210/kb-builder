Created by 未知用户 (liaofeng), last modified by  曾思尹 on 十一月 06, 2023

#   [DBMS_ROWID高级包 Design（DBMS_ROWID高级包方案设计）](#dbms-rowid高级包-designdbms-rowid高级包方案设计)  

SR链接：

  [YDBRD-21687](https://jira.yasdb.com/browse/YDBRD-21687?src=confmacro)    -  补充DBMS_ROWID的ROWID_BLOCK_NUMBER函数  完成

  [YDBRD-21690](https://jira.yasdb.com/browse/YDBRD-21690?src=confmacro)    -  补充DBMS_ROWID的ROWID_RELATIVE_FNO函数  完成

  [YDBRD-21691](https://jira.yasdb.com/browse/YDBRD-21691?src=confmacro)    -  补充DBMS_ROWID的ROWID_ROW_NUMBER函数  完成

##   [1. Overview（概述）](#1-overview概述)  

背景：    
  DBMS_ROWID使用PL/SQL程序或SQL语句获取rowid的信息    
  需求描述：    
  支持DBMS_ROWID高级包，包括：    
  ROWID_BLOCK_NUMBER函数    
  ROWID_RELATIVE_FNO函数    
  ROWID_ROW_NUMBER函数

##   [2. Features（功能特性）](#2-features功能特性)  

**语法:**

```
--获取rowid中的数据所在数据块号信息
--返回rowid记录的block字段
DBMS_ROWID.ROWID_BLOCK_NUMBER (
   row_id      IN  ROWID,
   ts_type_in  IN  VARCHAR DEFAULT 'SMALLFILE')
RETURN NUMBER;

--获取rowid中的数据所在相对文件号信息
--返回rowid记录的file字段
DBMS_ROWID.ROWID_RELATIVE_FNO (
   row_id      IN  ROWID,
   ts_type_in  IN  VARCHAR DEFAULT 'SMALLFILE')
RETURN NUMBER;

--获取rowid中的数据所在行号信息
--返回rowid记录的dir字段
DBMS_ROWID.ROWID_ROW_NUMBER (
   row_id  IN  ROWID)
RETURN NUMBER;

```

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|row_id|IN|ROWID|是|-|待解释的ROWID，可为ROWID类型或者可以隐式转换为ROWID的其他类型（CHAR，NCHAR, VARCHAR，NVARCHAR，RAW）|
|ts_type_in|IN|VARCHAR|否|'SMALLFILE'|保留字段，仅语法兼容，仅支持'SMALLFILE'和'BIGFILE'，不区分大小写，可为字符类型或者可转换为字符类型的其他类型|


|函数|返回值的数据类型|说明|
|---|---|---|
|ROWID_BLOCK_NUMBER|NUMBER|返回rowid记录中的数据所在数据块号信息，即block字段|
|ROWID_RELATIVE_FNO|NUMBER|返回rowid记录中的数据所在相对文件号信息，即file字段|
|ROWID_ROW_NUMBER|NUMBER|返回rowid记录中的数据所在行号信息，即dir字段|


|异常|错误码|报错情况|
|---|---|---|
|-|ERR_ANS_EXEC_DATA_TYPE_MISMATCH|参数的数据类型不匹配|
|-|ERR_ANS_PARAM_INVALID_VALUE|ts_type_in参数的值无效，应该为'smallfile'或'bigfile'|
|DBMS_ROWID.ROWID_INVALID|ERR_ANK_INVALID_ROWID|无效的rowid字符串|


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
// DBMS_ROWID.ROWID_BLOCK_NUMBER
static CodResult bipVerifyRowidBlockNumber(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeRowidBlockNumber(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecRowidBlockNumber(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_ROWID.ROWID_RELATIVE_FNO
static CodResult bipVerifyRowidRelativeFno(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeRowidRelativeFno(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecRowidRelativeFno(AnlStmt* stmt, ExprNode* node, Variant* retValue)

// DBMS_ROWID.ROWID_ROW_NUMBER
static CodResult bipVerifyRowidRowNumber(AnlVerifier* vrfr, ExprNode* node)
static CodResult bipConcludeRowidRowNumber(AnlStmt* stmt, ExprNode* node, TypeDesc* retType)
static CodResult bipExecRowidRowNumber(AnlStmt* stmt, ExprNode* node, Variant* retValue)

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 只支持单机，集群（分布式不支持）
- 只支持heap表（列表本身不支持rowid）
- ts_type_in参数只做语法兼容


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

**1. row_id参数**    
  ROWID格式如下：

```
dataoid:spaceId:fileId:blockId:dir    

```

data object id，行所在的Segment的ID，该值可从user_objects等视图中查询获得    
  space id，行所在的表空间的ID，该值可从v$tablespace等视图中查询获得    
  file id，行所在数据文件在对应表空间中的数据文件ID，该值可从v$datafile等视图中查询获得    
  block id，行所在数据块在对应文件中的块ID    
  dir，行在数据块上的槽位    
  rowid高级包函数需要读取记录rowid的结构体VarRowId，返回相应的字段    
  其中块号对应rowid.block，相对文件号对应rowid.file，行号对应rowid.dir    
  当rowid=null时返回0

**2. ts_type_in参数**    
  保留字段，仅语法兼容，仅支持'SMALLFILE'和'BIGFILE'，不区分大小写，可为字符类型或者可转换为字符类型的其他类型    
  当ts_type_in参数输入为null值，或者不是'smallfile'和'bigfile'时，报错“ts_type_in参数无效，应该为'smallfile'或'bigfile'”

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

已有的rowid数据结构

```
typedef struct StVarRowId
{
    CodUint64      dataObjectId;  // 行所在的Segment的ID，该值可从user_objects等视图中查询获得
    union {
        CodUint64      value;
        struct {
            CodUint32      file   : 6;  // 行所在数据文件在对应表空间中的数据文件ID，该值可从v$datafile等视图中查询获得
            CodUint32      block  : 26;  // 行所在数据块在对应文件中的块ID
            CodUint16      dir;  // 行在数据块上的槽位
            CodUint16      space;  // 行所在的表空间的ID，该值可从v$tablespace等视图中查询获得
        };
    };
}VarRowId;

```

exec阶段流程

![](https://pingcode.yasdb.com/atlas/files/public/67396c238970c2af4f520977/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTkyMTksImV4cCI6MTc4MjMxMDAxOX0.Bxct5t4D9RDb_x2IrihLCW3uyzcsJdqfrrjF3v9EQ7g)

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

与Oracle的差异：

- rowid的格式不同
- YASDB类型转换支持raw类型转换为rowid类型，在Oracle中上述函数rowid参数输入raw类型变量会报错“参数类型错误”
- Oracle tablespace类型分smallfile和bigfile，YASDB无对应，ts_type_in参数设置为语法兼容保留字段
- 当ts_type_in参数输入为null值，或者不是'smallfile'和'bigfile'时，报错“ts_type_in参数无效，应该为'smallfile'或'bigfile'”，而Oracle报错无效的rowid（该参数决定rowid的解析规则），可由ROWID_INVALID异常捕获
- 在Oracle中，当ts_type_in参数输入为'bigfile'时，相对文件号固定返回1024，这是因为bigfile类型表空间只有一个数据文件，1024 > smallfile表空间相对文件号上限1023


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

（1）测试DBMS_ROWID高级包函数在pl/sql语句中的常用场景

- 检查函数返回值是否正确


（2）测试参数限制，检查函数返回值或报错信息是否正确

- rowid参数为null
- rowid参数为rowid类型变量
- rowid参数为CHAR，NCHAR, VARCHAR，NVARCHAR类型变量，且字符串内容符合/不符合rowid格式
- rowid参数为RAW类型变量，且字节内容满足/不满足rowid对字节内容的格式要求
- rowid参数为其他类型的变量
- ts_type_in参数为null
- ts_type_in参数为'smallfile'或'bigfile'，不区分大小写
- ts_type_in参数为其他字符串或其他类型变量


（3）测试DBMS_ROWID高级包预定义的异常

- DBMS_ROWID.ROWID_INVALID异常


##   [7. Document（资料）](#7-document资料)  

  [Oracle Database 19c DBMS_ROWID文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_ROWID.html#GUID-66872807-DA5F-4AD8-B447-69BCB258D69B)  

##   [8. Workload（工作量）](#8-workload工作量)  

工作量1周

##   [9. TODO（遗留问题）](#9-todo遗留问题)  

## Attachments:

[未命名文件 (1).png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMjJhMWFkOWEzMzExZGM4N2U2IiwicmVmX2lkIjoiNjczOTZjMjI3MjgyMDZlZmI5MmYwZTE4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5MjE5LCJleHAiOjE3ODIzODU2MTl9.5jPG4Nfr3a7OifIURhiRe0zk-jwKR8zVUg00DiSt_SU)

 (image/png)    


## Comments:

|  [](null)  ,列表lsc的rowid，rowid格式,分布式是否考虑拦截,Posted by tangwenlin at 十月 17, 2023 17:18|
|---|
|  [](null)  ,高级包权限,Posted by tangwenlin at 十月 17, 2023 17:20|
|  [](null)  ,列表不用支持，分布式拦截,Posted by zengsiyin at 十月 17, 2023 17:52|
|  [](null)  ,有单独的需求做高级包权限,Posted by zengsiyin at 十月 17, 2023 17:55|
