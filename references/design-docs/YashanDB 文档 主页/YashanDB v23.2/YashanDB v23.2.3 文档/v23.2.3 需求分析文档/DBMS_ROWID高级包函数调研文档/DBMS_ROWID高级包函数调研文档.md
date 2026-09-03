Created by 曾思尹, last modified on 十月 18, 2023

#   [DBMS_ROWID高级包函数Research（DBMS_ROWID高级包函数特性调研）](#dbms-rowid高级包函数researchdbms-rowid高级包函数特性调研)  

SR链接：

  [YDBRD-21687](https://jira.yasdb.com/browse/YDBRD-21687?src=confmacro)    -  补充DBMS_ROWID的ROWID_BLOCK_NUMBER函数  完成

  [YDBRD-21690](https://jira.yasdb.com/browse/YDBRD-21690?src=confmacro)    -  补充DBMS_ROWID的ROWID_RELATIVE_FNO函数  完成

  [YDBRD-21691](https://jira.yasdb.com/browse/YDBRD-21691?src=confmacro)    -  补充DBMS_ROWID的ROWID_ROW_NUMBER函数  完成

##   [](#)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c DBMS_ROWID文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_ROWID.html#GUID-66872807-DA5F-4AD8-B447-69BCB258D69B)  

（1）  **ROWID_BLOCK_NUMBER**  ：输入ROWID，返回其中的数据库块号    
  （2）  **ROWID_RELATIVE_FNO**  ：输入ROWID，返回其中的相对文件号（文件号是相对于表空间的）    
  （3）  **ROWID_ROW_NUMBER**  ：输入ROWID，返回其中的行号

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 ROWID_BLOCK_NUMBER Function](#21-rowid-block-number-function)  

Oracle ROWID采用Base64编码，由四部分共18位组成：    
  第一部分6位表示：该行数据所在的数据对象data_object_id    
  第二部分3位表示：该行数据所在的相对数据文件id    
  第三部分6位表示：该行数据所在的数据块编号    
  第四部分3位表示：该行数据的行编号

而YASDB ROWID格式如下：    
  dataoid:spaceId:fileId:blockId:dir    
  data object id，行所在的Segment的ID，该值可从user_objects等视图中查询获得    
  space id，行所在的表空间的ID，该值可从v$tablespace等视图中查询获得    
  file id，行所在数据文件在对应表空间中的数据文件ID，该值可从v$datafile等视图中查询获得    
  block id，行所在数据块在对应文件中的块ID    
  dir，行在数据块上的槽位

该函数返回ROWID中的数据块编号

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
DBMS_ROWID.ROWID_BLOCK_NUMBER (
   row_id      IN   ROWID,
   ts_type_in  IN   VARCHAR2 DEFAULT 'SMALLFILE')
  RETURN NUMBER;

```

####   [2.1.2 Pragmas（编译指示）](#212-pragmas编译指示)  

```
   pragma RESTRICT_REFERENCES(rowid_block_number,WNDS,RNDS,WNPS,RNPS);

```

####   [2.1.3 Parameter（参数）](#213-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|row_id|IN|ROWID|是|-|待解释的ROWID|
|ts_type_in|IN|VARCHAR2|否|'SMALLFILE'|该行所属表空间的类型（bigfile/smallfile）|


返回值：NUMBER类型，ROWID中的数据块编号

####   [2.1.4 Details（详细分析）](#214-details详细分析)  

（1）row_id参数限制    
  数据类型为ROWID，可以和字符类型互转。可为null，当为null值时函数返回0。    
  （2）ts_type_in参数限制    
  null值、能转换为字符类型的输入，如果不是'smallfile'或'bigfile'（大小写不敏感），报错无效rowid；不能转换为字符类型的输入，报错参数类型错误    
  bigfile的表空间类型对rowid的解析规则不同于smallfile

```
--row_id
--null test
begin
   dbms_output.put_line(dbms_rowid.rowid_block_number(row_id =&gt; null));
end;
/
OUTPUT:
0

PL/SQL 过程已成功完成。

--char to rowid test 1: invalid rowid
begin
   dbms_output.put_line(dbms_rowid.rowid_block_number(row_id =&gt; '120'));
end;
/
OUTPUT:
begin
*
第 1 行出现错误:
ORA-01410: 无效的 ROWID
ORA-06512: 在 "SYS.DBMS_ROWID", line 114
ORA-06512: 在 line 2

--char to rowid test 2: valid rowid
--rowid数据块号为AAAAGU，查编码表A=0,G=6,U=20,6*64+20=404
begin
   dbms_output.put_line(dbms_rowid.rowid_block_number(row_id =&gt; 'AAAUrwAAHAAAAGUAAA'));
end;
/
OUTPUT:
404

PL/SQL 过程已成功完成。

--other type to rowid test
declare
a int := 120;
begin
dbms_output.put_line(dbms_rowid.rowid_block_number(row_id =&gt; a));
end;
/
OUTPUT:
dbms_output.put_line(dbms_rowid.rowid_block_number(row_id =&gt; a));
                     *
第 4 行出现错误:
ORA-06550: 第 4 行, 第 22 列:
PLS-00306: 调用 'ROWID_BLOCK_NUMBER' 时参数个数或类型错误
ORA-06550: 第 4 行, 第 1 列:
PL/SQL: Statement ignored

--常见用法
create table tri(id int);
insert into tri values (1);
insert into tri values (2);

select dbms_rowid.rowid_block_number(rowid)
from tri
where id=1;
OUTPUT:
DBMS_ROWID.ROWID_BLOCK_NUMBER(ROWID)
------------------------------------
                                 404


--ts_type_in
--other data type test
declare
a blob;
begin
dbms_output.put_line(dbms_rowid.rowid_block_number('AAAUrwAAHAAAAGUAAA',a));
end;
/
OUTPUT:
dbms_output.put_line(dbms_rowid.rowid_block_number('AAAUrwAAHAAAAGUAAA',a));
                     *
第 4 行出现错误:
ORA-06550: 第 4 行, 第 22 列:
PLS-00306: 调用 'ROWID_BLOCK_NUMBER' 时参数个数或类型错误
ORA-06550: 第 4 行, 第 1 列:
PL/SQL: Statement ignored

--to char type test
begin
dbms_output.put_line(dbms_rowid.rowid_block_number('AAAUrwAAHAAAAGUAAA',null));
end;
/
begin
dbms_output.put_line(dbms_rowid.rowid_block_number('AAAUrwAAHAAAAGUAAA',120));
end;
/
begin
dbms_output.put_line(dbms_rowid.rowid_block_number('AAAUrwAAHAAAAGUAAA','aaa'));
end;
/
OUTPUT:
begin
*
第 1 行出现错误:
ORA-01410: 无效的 ROWID
ORA-06512: 在 "SYS.DBMS_ROWID", line 114
ORA-06512: 在 line 2

--bigfile的表空间类型对rowid的解析规则不同于smallfile
declare
a number(20);
begin
a:=dbms_rowid.rowid_block_number('AAAUrwAAHAAAAGUAAA','bigfile');
dbms_output.put_line(a);
end;
/
OUTPUT:
29360532

PL/SQL 过程已成功完成。

```

###   [2.2 ROWID_RELATIVE_FNO Function](#22-rowid-relative-fno-function)  

####   [2.2.1 Syntax（语法）](#221-syntax语法)  

```
DBMS_ROWID.ROWID_RELATIVE_FNO (
   row_id      IN   ROWID,
   ts_type_in    IN   VARCHAR2 DEFAULT 'SMALLFILE')
  RETURN NUMBER;

```

####   [2.2.2 Pragmas（编译指示）](#222-pragmas编译指示)  

```
   pragma RESTRICT_REFERENCES(rowid_relative_fno,WNDS,RNDS,WNPS,RNPS);

```

####   [2.2.3 Parameter（参数）](#223-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|row_id|IN|ROWID|是|-|待解释的ROWID|
|ts_type_in|IN|VARCHAR2|否|'SMALLFILE'|该行所属表空间的类型（bigfile/smallfile）|


####   [2.2.4 Details（详细分析）](#224-details详细分析)  

（1）row_id参数限制    
  数据类型为ROWID，可以和字符类型互转。可为null，当为null值时函数返回0。    
  （2）ts_type_in参数限制    
  null值、能转换为字符类型的输入，如果不是'smallfile'或'bigfile'（大小写不敏感），报错无效rowid；不能转换为字符类型的输入，报错参数类型错误    
  bigfile类型表空间只有一个数据文件，相对文件号固定为1024（small类型表空间相对文件号上限为1023）

```
--row_id
--null test
begin
   dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO(row_id =&gt; null));
end;
/
OUTPUT:
0

PL/SQL 过程已成功完成。

--char to rowid test 1: invalid rowid
begin
   dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO(row_id =&gt; '120'));
end;
/
OUTPUT:
begin
*
第 1 行出现错误:
ORA-01410: 无效的 ROWID
ORA-06512: 在 "SYS.DBMS_ROWID", line 98
ORA-06512: 在 line 2

--char to rowid test 2: valid rowid
--rowid相对文件号为AAH，查编码表A=0,H=7,7*1=7
begin
   dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO(row_id =&gt; 'AAAUrwAAHAAAAGUAAA'));
end;
/
OUTPUT:
7

PL/SQL 过程已成功完成。

--other type to rowid test
declare
a int := 120;
begin
dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO(row_id =&gt; a));
end;
/
OUTPUT:
dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO(row_id =&gt; a));
                     *
第 4 行出现错误:
ORA-06550: 第 4 行, 第 22 列:
PLS-00306: 调用 'ROWID_RELATIVE_FNO' 时参数个数或类型错误
ORA-06550: 第 4 行, 第 1 列:
PL/SQL: Statement ignored

--常见用法
select dbms_rowid.ROWID_RELATIVE_FNO(rowid)
from tri
where id=1;
OUTPUT:
DBMS_ROWID.ROWID_RELATIVE_FNO(ROWID)
------------------------------------
                                   7


--ts_type_in
--other data type test
declare
a blob;
begin
dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO('AAAUrwAAHAAAAGUAAA',a));
end;
/
OUTPUT:
dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO('AAAUrwAAHAAAAGUAAA',a));
                     *
第 4 行出现错误:
ORA-06550: 第 4 行, 第 22 列:
PLS-00306: 调用 'ROWID_RELATIVE_FNO' 时参数个数或类型错误
ORA-06550: 第 4 行, 第 1 列:
PL/SQL: Statement ignored

--to char type test
begin
dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO('AAAUrwAAHAAAAGUAAA',null));
end;
/
begin
dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO('AAAUrwAAHAAAAGUAAA',120));
end;
/
begin
dbms_output.put_line(dbms_rowid.ROWID_RELATIVE_FNO('AAAUrwAAHAAAAGUAAA','aaa'));
end;
/
OUTPUT:
begin
*
第 1 行出现错误:
ORA-01410: 无效的 ROWID
ORA-06512: 在 "SYS.DBMS_ROWID", line 98
ORA-06512: 在 line 2

--bigfile类型表空间只有一个数据文件，相对文件号固定为1024（small类型表空间相对文件号上限为1023）
declare
a number(20);
begin
a:=dbms_rowid.ROWID_RELATIVE_FNO('AAAUrwAAHAAAAGUAAA','bigfile');
dbms_output.put_line(a);
end;
/
OUTPUT:
1024

PL/SQL 过程已成功完成。

```

###   [2.3 ROWID_ROW_NUMBER Function](#23-rowid-row-number-function)  

####   [2.3.1 Syntax（语法）](#231-syntax语法)  

```
DBMS_ROWID.ROWID_ROW_NUMBER (
   row_id IN ROWID)
  RETURN NUMBER;

```

####   [2.3.2 Pragmas（编译指示）](#232-pragmas编译指示)  

```
   PRAGMA RESTRICT_REFERENCES(rowid_row_number,WNDS,RNDS,WNPS,RNPS);

```

####   [2.3.3 Parameter（参数）](#233-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|row_id|IN|ROWID|是|-|待解释的ROWID|


####   [2.3.4 Details（详细分析）](#234-details详细分析)  

（1）row_id参数限制    
  数据类型为ROWID，可以和字符类型互转。可为null，当为null值时函数返回0。

```
--null test
begin
   dbms_output.put_line(dbms_rowid.ROWID_ROW_NUMBER(row_id =&gt; null));
end;
/
OUTPUT:
0

PL/SQL 过程已成功完成。

--char to rowid test 1: invalid rowid
begin
   dbms_output.put_line(dbms_rowid.ROWID_ROW_NUMBER(row_id =&gt; 'aaa'));
end;
/
OUTPUT:
begin
*
第 1 行出现错误:
ORA-01410: 无效的 ROWID
ORA-06512: 在 "SYS.DBMS_ROWID", line 129
ORA-06512: 在 line 2

--char to rowid test 2: valid rowid
--rowid行号为AAB，查编码表A=0,B=1,1*1=1
begin
   dbms_output.put_line(dbms_rowid.ROWID_ROW_NUMBER(row_id =&gt; 'AAAUrwAAHAAAAGUAAB'));
end;
/
OUTPUT:
1

PL/SQL 过程已成功完成。

--other type to rowid test
declare
a int := 120;
begin
dbms_output.put_line(dbms_rowid.ROWID_ROW_NUMBER(row_id =&gt; a));
end;
/
OUTPUT:
dbms_output.put_line(dbms_rowid.ROWID_ROW_NUMBER(row_id =&gt; a));
                     *
第 4 行出现错误:
ORA-06550: 第 4 行, 第 22 列:
PLS-00306: 调用 'ROWID_ROW_NUMBER' 时参数个数或类型错误
ORA-06550: 第 4 行, 第 1 列:
PL/SQL: Statement ignored

--常见用法
select dbms_rowid.ROWID_ROW_NUMBER(rowid)
from tri
where id=2;
OUTPUT:
DBMS_ROWID.ROWID_ROW_NUMBER(ROWID)
----------------------------------
                                 1

```

###   [2.4 DBMS_ROWID Exceptions](#24-dbms-rowid-exceptions)  

|异常|错误码|说明|
|---|---|---|
|DBMS_ROWID.ROWID_INVALID|1410|ROWID格式错误|
|DBMS_ROWID.ROWID_BAD_BLOCK|28516|数据块超出文件末尾|


```
ROWID_INVALID exception;
   pragma exception_init(ROWID_INVALID, -1410);

ROWID_BAD_BLOCK exception;
   pragma exception_init(ROWID_BAD_BLOCK, -28516);

```

用例

```
declare
rowidstr varchar(100):='aaa';
num number;
begin
num:=dbms_rowid.ROWID_ROW_NUMBER(row_id =&gt; rowidstr);
exception
  when dbms_rowid.ROWID_INVALID then
    dbms_output.put_line('invalid rowid: '||rowidstr);
end;
/
OUTPUT:
invalid rowid: aaa

PL/SQL 过程已成功完成。

declare
rowidstr varchar(100):='aaa';
num number;
begin
num:=dbms_rowid.ROWID_RELATIVE_FNO(row_id =&gt; rowidstr);
exception
  when dbms_rowid.ROWID_INVALID then
    dbms_output.put_line('invalid rowid: '||rowidstr);
end;
/
OUTPUT:
invalid rowid: aaa

PL/SQL 过程已成功完成。

declare
rowidstr varchar(100):='aaa';
num number;
begin
num:=dbms_rowid.ROWID_BLOCK_NUMBER(row_id =&gt; rowidstr);
exception
  when dbms_rowid.ROWID_INVALID then
    dbms_output.put_line('invalid rowid: '||rowidstr);
end;
/
OUTPUT:
invalid rowid: aaa

PL/SQL 过程已成功完成。

```

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

## Comments:

|  [](null)  ,调研异常捕获,Posted by tangwenlin at 十月 17, 2023 17:14|
|---|
|  [](null)  ,已补充调研,Posted by zengsiyin at 十月 17, 2023 18:51|
