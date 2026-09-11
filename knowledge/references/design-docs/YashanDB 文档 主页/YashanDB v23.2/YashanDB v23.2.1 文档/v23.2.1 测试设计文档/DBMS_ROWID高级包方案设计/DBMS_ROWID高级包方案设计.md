Created by 李美娥, last modified on 十一月 08, 2023

本文描述    [DBMS_ROWID](https://jira.yasdb.com/browse/YDBRD-21687)    高级包的测试设计，使用PL/SQL程序或SQL语句获取rowid的信息  。

Oracle文档：    [DBMS_ROWID高级包函数调研文档 - 曾思尹 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=130144169)  

开发设计：    [DBMS_ROWID高级包设计方案](https://conf.yasdb.com/pages/viewpage.action?pageId=130154018)  

SR：   

  [YDBRD-21687](https://jira.yasdb.com/browse/YDBRD-21687?src=confmacro)    -  补充DBMS_ROWID的ROWID_BLOCK_NUMBER函数  完成

  [YDBRD-21690](https://jira.yasdb.com/browse/YDBRD-21690?src=confmacro)    -  补充DBMS_ROWID的ROWID_RELATIVE_FNO函数  完成

  [YDBRD-21691](https://jira.yasdb.com/browse/YDBRD-21691?src=confmacro)    -  补充DBMS_ROWID的ROWID_ROW_NUMBER函数  完成

# **2. 需求分析**

## 2.1语法

（1）DBMS_ROWID.ROWID_BLOCK_NUMBER ( row_id IN ROWID, ts_type_in IN VARCHAR2 DEFAULT 'SMALLFILE') RETURN NUMBER;

![](https://pingcode.yasdb.com/atlas/files/public/67396b8e8970c2af4f520569/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFFQUNBQUFBQUFBQUVBQUFBQUJBQUFCQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUJDQUNBUUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFDQUJBQUFBQUFBQ0FBQUFnQUFBQUFBQUFBQkFCQUFBQUFJQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU0NzAsImV4cCI6MTc4MjMwNjI3MH0.y07-Pr3bnWd8cLaOUITUcmvbXo1wDocdiJQ8OuiLgCY)

（2）  DBMS_ROWID.ROWID_RELATIVE_FNO ( rowid_id IN ROWID, ts_type_in IN VARCHAR2 DEFAULT 'SMALLFILE') RETURN NUMBER;

![](https://pingcode.yasdb.com/atlas/files/public/67396b8e8970c2af4f52056b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFFQUNBQUFBQUFBQUVBQUFBQUJBQUFCQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUJDQUNBUUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFDQUJBQUFBQUFBQ0FBQUFnQUFBQUFBQUFBQkFCQUFBQUFJQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU0NzAsImV4cCI6MTc4MjMwNjI3MH0.y07-Pr3bnWd8cLaOUITUcmvbXo1wDocdiJQ8OuiLgCY)

（3）  DBMS_ROWID.ROWID_ROW_NUMBER ( row_id IN ROWID) RETURN NUMBER;

![](https://pingcode.yasdb.com/atlas/files/public/67396b8e8970c2af4f52056c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFFQUNBQUFBQUFBQUVBQUFBQUJBQUFCQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUJDQUNBUUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFDQUJBQUFBQUFBQ0FBQUFnQUFBQUFBQUFBQkFCQUFBQUFJQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU0NzAsImV4cCI6MTc4MjMwNjI3MH0.y07-Pr3bnWd8cLaOUITUcmvbXo1wDocdiJQ8OuiLgCY)

bigfile是语法兼容，结果同smallfile。

rowid是  dataoid:spaceId:fileId:blockId:dir =   2260:7:0:132:0，如  DBMS_ROWID.ROWID_BLOCK_NUMBER返回的是block字段132（数据所在数据块号消息），

DBMS_ROWID.ROWID_RELATIVE_FNO返回rowid记录的file字段（数据所在相对文件号信息）0，返回rowid记录的dir字段（数据所在行号信息）0，其中

的返回值可以跟截取rowid的某段进行比对。

## 2.2 参数：

|参数|参数类型|数据类型|是否必填|默认值|说明|
|:---|:---|:---|:---|:---|:---|
|row_id|IN|ROWID|是|-|待解释的ROWID，表的伪列，或者直接传入ROWID|
|ts_type_in|IN|VARCHAR|否|'SMALLFILE'|保留字段，仅语法兼容。|


rowid可接受字符型、RAW、urowid等可以隐式转换为ROWID类型的符合rowid格式要求的数据。（表中的rowid还存在/rowid对应的数据已经被删，rowid已经不存在）

ts_type_in仅接受SMALLFILE、BIGFILE

## 2.3 错误码

|异常|错误码|报错情况|
|:---|:---|:---|
|-|ERR_ANS_EXEC_DATA_TYPE_MISMATCH|参数的数据类型不匹配|
|-|ERR_ANS_PARAM_INVALID_VALUE|ts_type_in参数的值无效，应该为'smallfile'或'bigfile',（跟oracle存在差异的地方：oracle  第二个参数传SMALLFILE、BIGFILE以外的数会报此错误ORA-01410: invalid ROWID）|
|dbms_rowid.ROWID_INVALID|ERR_ANK_INVALID_ROWID|无效的rowid字符串，  此错误，异常分类SYS_INVALID_ROWID也能捕获|
|  
|其他|对象本身无rowid，使用此函数去获取rowid的报错（列存表）--不单独处理，用的是本身查询rowid的报错,传入的个数不匹配--采用高级包统一的错误码|


关注构造的错误对应的错误码正确，且错误码的分类正确。

## 2.4 常用场景。

     无。

（1）是否可以给这些内置函数创建同名词，  SYNONYM，我们不可以（容错）  。--oracle可以，但同名词无法使用，CREATE SYNONYM sy_area1 FOR dbms_rowid.rowid_block_number;

常用场景1：

![](https://pingcode.yasdb.com/atlas/files/public/67396b8fa1ad9a3311dc83e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFFQUNBQUFBQUFBQUVBQUFBQUJBQUFCQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUJDQUNBUUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFDQUJBQUFBQUFBQ0FBQUFnQUFBQUFBQUFBQkFCQUFBQUFJQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU0NzAsImV4cCI6MTc4MjMwNjI3MH0.y07-Pr3bnWd8cLaOUITUcmvbXo1wDocdiJQ8OuiLgCY)

常用场景2：

![](https://pingcode.yasdb.com/atlas/files/public/67396b8f8970c2af4f52056d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBQUFBQUFBQUFBQUFFQUNBQUFBQUFBQUVBQUFBQUJBQUFCQUFBQUFBQUFBQUFBRUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUJDQUNBUUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFDQUJBQUFBQUFBQ0FBQUFnQUFBQUFBQUFBQkFCQUFBQUFJQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTU0NzAsImV4cCI6MTc4MjMwNjI3MH0.y07-Pr3bnWd8cLaOUITUcmvbXo1wDocdiJQ8OuiLgCY)

# **3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|关键字校验|/|- 高级包覆盖 全大小，全小写，大小写混合
|  
|- 高级包拼写缺失
- 缺少  DBMS_ROWID
|报错，提示正确|
||/|- 创建、删除同名udp（sys用户）
|成功|  
|/|
|参数校验|/|- 覆盖传参的数据类型与参数的类型匹配
- 覆盖传参的数据类型与参数的类型不符合，但可以隐式转换（row_id：字符型特别是nchar nvarchar、raw、urowid/ts_type_in：clob 、blob、 nclob、 raw、 json 、rowid、 urowid），注意其他类型的值尽量是合法的rowid，ts_type_in的转换可以不用重点测试，本身参数并不实现功能，仅是语法兼容
- 入参是其他函数，返回值为合法rowid和字符如dbms_rowid.rowid_block_number('XXX', SUBSTR('absmallfile',3))
- 支持2个入参的，仅传入一个rowid，第二参数会使用默认值
- row_id的入参是null、''
- rowid的后面3部分是rowid允许的最大值，传入高级包（file最大值是63，block是2的26次方，dir是4096--实际测试dir最大只能4095，构造是4095高级包去获取）
|  
|- 不传入参数
- 传入3个参数（只一个入参的，传入2个参数）
- 传入的参数数据类型与参数值无法转换
- 未定义的变量；
- ts_type_in的入参是null、’‘
|报错，提示正确|
|高级包返回值类型|/|采用typeof查看高级包的返回值,返回值做四则运算|  
|  
|  
|
|plsql|自定义函数/存储过程/匿名块|根据常用场景1，主要是把表中的某个或某些字段的rowid获取到作为变量传递给高级包，高级包再获取rowid信息，同时还考虑把高级包使用在plsql可以放置的位置。,- case xx when（多个），部分when调用高级包，部分不调用；构造数据匹配when条件
- if  else分支、while分支、return、exception、for、loop调用高级包
- row_id用动态绑定参数传值、参数传入常量值
- row_id传入的是record udt里面的rowid类型的数据
- 匿名块调用高级包，调用其他plsql（里面也调用高级包）
- package中调用存储过程，存储过程调用自定义函数，自定义函数里面调用高级包
|  
|  
|  
|
|  
|自定义高级包|- head中调用高级包，body中不调用
- head中不调用，body中调用
- head、body中同时调用
|  
|  
|  
|
|  
|job|- 
,```
DBMS_JOB<span class="token punctuation" style="color: rgb(204,204,204);">.</span>SUBMIT创建job，what指定调用
含高级包的plsql，触发job运行
```|  
|  
|  
|
|场景二：表、视图、临时表|表|跟普通表和分区表应该没关系，可挑选穿插一个分区表：,- insert into table values 调用高级包
-  update set赋值给指定列时指定高级包
- delete作为where的限定条件
- group by 、order by使用高级包
,|  
|- 表是lsc tac表
- 表使用表空间，表空间被offline过，rowid无法查询(cannot be read at this time),采用SELECT dbms_rowid.rowid_block_number(rowid) from 表名;
- 建表作为默认值
|  
|
||视图|v$sql_plan、v$database、普通视图、物化视图|  
|dba_tables|  
|
||临时表|  
|  
|  
|test_sdv_python_rowid_08,里面有四种临时表|
|权限|/|- 暂不涉及
|  
|  
|  
|
|并发|  
|  
|  
|  
|  
|


# **4. 详细设计**

见第3章节

# **5**  .   **测试用例**

#   
  **6.**  **测试框架设计**

本次测试采用yasft测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# **7**  .   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机+集群（复用单机用例）+分布式（分布式测试拦截）|


## Attachments:

[高级包rowid.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGVhMWFkOWEzMzExZGM4M2RmIiwicmVmX2lkIjoiNjczOTZiOGU1OTNmOTljOWZmMjM2NDE2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1NDcwLCJleHAiOjE3ODIzODE4NzB9.XFUYj6dVP_isx8syqKQWPJe7CbPj6aBOo-6HIFPGHWE)

 (application/vnd.ms-excel)    
