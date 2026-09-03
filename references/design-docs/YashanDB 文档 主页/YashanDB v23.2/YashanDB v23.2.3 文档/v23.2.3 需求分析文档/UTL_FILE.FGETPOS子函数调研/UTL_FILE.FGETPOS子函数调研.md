Created by 邓秋怡, last modified on 十月 19, 2023

#   [UTL_FILE.FGETPOS高级包子函数Research（UTL_FILE.FGETPOS高级包子数特性调研）](#utl-filefgetpos高级包子函数researchutl-filefgetpos高级包子数特性调研)  

SR链接：

  [YDBRD-21680](https://jira.yasdb.com/browse/YDBRD-21680?src=confmacro)    -  高级包UTL_FILE新增FGETPOS子函数  完成

##   [](#)  

##   [1. Overview（概述）](#1-overview概述)  

  [Oracle Database 19c UTL_FILE.FGETPOS文档](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/database-pl-sql-packages-and-types-reference.pdf#page=4193&zoom=100,0,708)  

（1）  **FGETPOS**  ：输入fileType类型文件句柄，返回其文件指针的偏移。

##   [2. Features（功能特性）](#2-features功能特性)  

####   [2.1.1 Syntax（语法）](#211-syntax语法)  

```
UTL_FILE.FGETPOS (
	file IN FILE_TYPE)   
RETURN PLS_INTEGER;

```

####   [2.1.3 Parameter（参数）](#213-parameter参数)  

|参数|参数类型|数据类型|是否必填|默认值|说明|
|---|---|---|---|---|---|
|file|IN|FILE_TYPE|是|-|文件句柄|


返回值：INTEGER类型，返回其文件指针的偏移

####   [2.1.4 Details（详细分析）](#214-details详细分析)  

（1）file 参数限制    
  有且只能有一个参数，且参数类型为FILE_TYPE 。

|入参|结果|
|---|---|
|空|PLS-00306: 调用 'FGETPOS' 时参数个数或类型错误|
|显式NULL|ORA-29282: 文件 ID 无效|
|非fileType|PLS-00306: 调用 'FGETPOS' 时参数个数或类型错误|
|fileType，未初始化|ORA-29282: 文件 ID 无效|
|fileType，已初始化但状态为closed|ORA-29282: 文件 ID 无效|
|fileType，已初始化且状态为open，但打开模式为二进制（b）|打开ORA-29283: 无效的文件操作|
|fileType，已初始化且状态为open，且打开模式非b类型打开|正常执行|


```
SQL&gt; --YDBRD-18477  NULL test
SQL&gt; declare
  2     i      INTEGER;
  3     begin
  4   i := UTL_FILE.fgetpos();
  5   DBMS_OUTPUT.PUT_LINE('pos:'||i);
  6     end;
  7  /
 i := UTL_FILE.fgetpos();
      *
第 4 行出现错误:
ORA-06550: 第 4 行, 第 7 列:
PLS-00306: 调用 'FGETPOS' 时参数个数或类型错误
ORA-06550: 第 4 行, 第 2 列:
PL/SQL: Statement ignored


SQL&gt;
SQL&gt; declare
  2     i      INTEGER;
  3     begin
  4   i := UTL_FILE.fgetpos(NULL);
  5   DBMS_OUTPUT.PUT_LINE('pos:'||i);
  6     end;
  7  /
declare
*
第 1 行出现错误:
ORA-29282: 文件 ID 无效
ORA-06512: 在 "SYS.UTL_FILE", line 1270
ORA-06512: 在 line 4


SQL&gt;
SQL&gt; declare
  2     i      INTEGER;
  3     begin
  4   i := UTL_FILE.fgetpos('NULL');
  5   DBMS_OUTPUT.PUT_LINE('pos:'||i);
  6     end;
  7  /
 i := UTL_FILE.fgetpos('NULL');
      *
第 4 行出现错误:
ORA-06550: 第 4 行, 第 7 列:
PLS-00306: 调用 'FGETPOS' 时参数个数或类型错误
ORA-06550: 第 4 行, 第 2 列:
PL/SQL: Statement ignored


SQL&gt;
SQL&gt;
SQL&gt; --YDBRD-18477  type error test
SQL&gt; declare
  2     i      INTEGER;
  3     j      INTEGER;
  4     begin
  5   i := UTL_FILE.fgetpos(j);
  6   DBMS_OUTPUT.PUT_LINE('pos:'||i);
  7     end;
  8  /
 i := UTL_FILE.fgetpos(j);
      *
第 5 行出现错误:
ORA-06550: 第 5 行, 第 7 列:
PLS-00306: 调用 'FGETPOS' 时参数个数或类型错误
ORA-06550: 第 5 行, 第 2 列:
PL/SQL: Statement ignored


SQL&gt;
SQL&gt;
SQL&gt; --YDBRD-18477  fgetpos(not inited file)  --id error
SQL&gt; DECLARE
  2   infile     UTL_FILE.file_type;
  3   i          PLS_INTEGER;
  4  BEGIN
  5    i := UTL_FILE.fgetpos (infile);
  6    DBMS_OUTPUT.put_line ('infile:'||TO_CHAR (i));
  7
  8  END ;
  9  /
DECLARE
*
第 1 行出现错误:
ORA-29282: 文件 ID 无效
ORA-06512: 在 "SYS.UTL_FILE", line 1270
ORA-06512: 在 line 5


SQL&gt;
SQL&gt; --YDBRD-18477  fgetpos(closed file)  --id error
SQL&gt; DECLARE
  2      infile     UTL_FILE.file_type;
  3      i          PLS_INTEGER;
  4  BEGIN
  5      infile := UTL_FILE.fopen ('ORADIR_HY', 'in_18477.txt', 'r');
  6      UTL_FILE.fclose (infile);
  7      i := UTL_FILE.fgetpos (infile);
  8      DBMS_OUTPUT.put_line ('infile:'||TO_CHAR (i));
  9  END ;
 10  /
DECLARE
*
第 1 行出现错误:
ORA-29282: 文件 ID 无效
ORA-06512: 在 "SYS.UTL_FILE", line 1270
ORA-06512: 在 line 7


SQL&gt;
SQL&gt; --YDBRD-18477  fgetpos(byte opened file)  --opera error  (yas目前本身就不支持二进制模式open)
SQL&gt; DECLARE
  2      infile     UTL_FILE.file_type;
  3      i          PLS_INTEGER;
  4  BEGIN
  5      infile := UTL_FILE.fopen ('ORADIR_HY', 'in_18477.txt', 'rb');
  6      i := UTL_FILE.fgetpos (infile);
  7      DBMS_OUTPUT.put_line ('infile:'||TO_CHAR (i));
  8  END ;
  9  /
DECLARE
*
第 1 行出现错误:
ORA-29283: 无效的文件操作
ORA-06512: 在 "SYS.UTL_FILE", line 1273
ORA-06512: 在 line 6


SQL&gt;
SQL&gt; --YDBRD-18477  fgetpos  yes
SQL&gt; DECLARE
  2      infile     UTL_FILE.file_type;
  3      i          PLS_INTEGER;
  4  BEGIN
  5      infile := UTL_FILE.fopen ('ORADIR_HY', 'in_18477.txt', 'r');
  6      if UTL_FILE.is_open(infile)
  7  then DBMS_OUTPUT.put_line ('success opened');
  8  end if;
  9  END ;
 10  /
success opened

PL/SQL 过程已成功完成。

```

（2）openMode影响文件可以以a,w,r类型打开，但以a,w打开时，不论文件写到哪个位置，FGETPOS的返回值都是0。

```
--YDBRD-18477  fgetpos(a opened file)  --pos always 0 
set serverout on;
DECLARE
    outfile     UTL_FILE.file_type;
    BUFFER_W    VARCHAR2(200);
    i           PLS_INTEGER;
  
BEGIN
    outfile := UTL_FILE.fopen ('ORADIR_HY', 'out_18477.txt', 'w');
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile:'||TO_CHAR (i));
     
    BUFFER_W := lpad('-', 20,'-');
    UTL_FILE.PUT_LINE(outfile, BUFFER_W);
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile_before_flush:'||TO_CHAR (i));
     
     
    UTL_FILE.Fflush(outfile);
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile_after_flush:'||TO_CHAR (i));
     
    UTL_FILE.fclose (outfile);
 
END ;
/

outfile:0
outfile_before_flush:0
outfile_after_flush:0


--YDBRD-18477  fgetpos(w opened file)  --pos always 0
DECLARE
    outfile     UTL_FILE.file_type;
    BUFFER_W    VARCHAR2(200);
    i           PLS_INTEGER;
  
BEGIN
    outfile := UTL_FILE.fopen ('ORADIR_HY', 'out_18477.txt', 'a');
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile:'||TO_CHAR (i));
     
    BUFFER_W := lpad('+', 20, '+');
     
    UTL_FILE.PUT_LINE(outfile, BUFFER_W);
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile_before_flush:'||TO_CHAR (i));
     
    UTL_FILE.Fflush(outfile);
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile_after_flush:'||TO_CHAR (i));
     
    UTL_FILE.fclose (outfile);
 
END ;
/

outfile:0
outfile_before_flush:0
outfile_after_flush:0

--YDBRD-18477  fgetpos(r opened file)   
DECLARE
    outfile     UTL_FILE.file_type;
    BUFFER_W    VARCHAR2(200);
    vnewline    VARCHAR2(200);
    i           PLS_INTEGER;
BEGIN
    outfile := UTL_FILE.fopen ('ORADIR_HY', 'out_18477.txt', 'r');
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile_start:'||TO_CHAR (i));
     
     
    UTL_FILE.get_line (outfile, vnewline);
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile_oneline:'||TO_CHAR (i));
     
    UTL_FILE.get_line (outfile, vnewline);
    i := UTL_FILE.fgetpos (outfile);                     
    DBMS_OUTPUT.put_line ('outfile_twoline:'||TO_CHAR (i));
     
    UTL_FILE.fclose (outfile);
 
END ;
/

outfile_start:0
outfile_oneline:21
outfile_twoline:42


```

(3)linux windows回车格式不同会导致结果不同linux下的换行符和windows下的换行符所占字节数不同  \r,\n,\r\n的区别 - 小 天 - 博客园 (cnblogs.com)    【Linux中遇到换行符("\n")会进行回车+换行的操作，回车符反而只会作为控制字符("^M")显示，不发生回车的操作。而windows中要回车符+换行符("\r\n")才会回车+换行，缺少一个控制符或者顺序不对都不能正确的另起一行。】

##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

INVALID_FILEHANDLE ：fgetpos未打开或未被赋值的文件句柄    
  INVALID_OPERATION ：当文件的打开模式是二进制打开的（但目前为止yas本身并不支持二进制打开模式，所以暂时不会在fgetpos中出现此错误。）    
  READ_ERROR：【暂时未找到报此错误的原因】    
  返回值相关：oracle fgetpos返回值直接用的32位截断，并不抛出异常。

```
--YDBRD-18477  return value bound
DECLARE
    HANDLE_W     UTL_FILE.file_type;
    i           PLS_INTEGER;
BUFFER_W   varchar(31000);
BEGIN
    HANDLE_W := UTL_FILE.fopen ('ORADIR_HY', 'bound1.txt', 'w',32000); 
BUFFER_W:=lpad('1',30000,'1');
for index_i in 1..80000 loop
UTL_FILE.PUT_LINE(HANDLE_W,BUFFER_W);
 
end loop;
 
    UTL_FILE.fclose (HANDLE_W);
END ;
/
 
DECLARE
    infile     UTL_FILE.file_type;
    vnewline   VARCHAR2 (32000);
    i          number(38) := 0;
    j          number(38);
BEGIN
    infile  := UTL_FILE.fopen ('ORADIR_HY', 'bound1.txt', 'r',32000);
 
    LOOP
    BEGIN
UTL_FILE.get_line (infile, vnewline,32000);   
        j := i;
        i := UTL_FILE.fgetpos (infile);                   
if(i&lt;0) 
then 
DBMS_OUTPUT.put_line ('i:'||TO_CHAR (i));
DBMS_OUTPUT.put_line ('j:'||TO_CHAR (j));
exit;
end if;  
    END;
    end loop;
    UTL_FILE.fclose (infile);                                                                            
END ;
/

i:-2147465715
j:2147471580

```

handle相关:手动赋值

```
--id open
SQL&gt; set serverout on;
SQL&gt; declare
  2     HANDLE UTL_FILE.FILE_TYPE;
  3     begin
  4       HANDLE := UTL_FILE.fopen('ORADIR_HY','in.txt','r',500);
  5       DBMS_OUTPUT.PUT_LINE('begin');
  6       DBMS_OUTPUT.PUT_LINE(HANDLE.id);
  7       DBMS_OUTPUT.PUT_LINE(HANDLE.dataType);
  8
  9       exception when others then
 10       DBMS_OUTPUT.PUT_LINE(sqlerrm);
 11     end;
 12  /
begin
1089407697
1

PL/SQL 过程已成功完成。

SQL&gt; declare
  2    HANDLE UTL_FILE.FILE_TYPE;
  3    i integer := 456;
  4    begin
  5      HANDLE.id := 1089407697;
  6      HANDLE.dataType := 1;
  7  i := utl_file.fgetpos(HANDLE);
  8      DBMS_OUTPUT.PUT_LINE('HANDLE t1.txt已经被打开,pos := '||i);
  9    end;
 10  /
HANDLE t1.txt已经被打开,pos := 0

PL/SQL 过程已成功完成。

SQL&gt; declare
  2    HANDLE UTL_FILE.FILE_TYPE;
  3    i integer := 456;
  4    begin
  5      HANDLE.id := 1089400000;
  6      HANDLE.dataType := 1;
  7  i := utl_file.fgetpos(HANDLE);
  8      DBMS_OUTPUT.PUT_LINE('HANDLE t1.txt已经被打开,pos := '||i);
  9    end;
 10  /
declare
*
第 1 行出现错误:
ORA-53203: 违反安全性
ORA-06512: 在 "SYS.UTL_FILE", line 332
ORA-06512: 在 "SYS.UTL_FILE", line 1275
ORA-06512: 在 line 7



set serverout on;
CREATE OR REPLACE PACKAGE pkg_handle IS
  g_id integer;
  g_dataType integer;
  g_byteMode boolean;
  HANDLE   UTL_FILE.FILE_TYPE;
  HANDLE_NOTINIT   UTL_FILE.FILE_TYPE;
  i integer := 456;
  procedure p1;
  procedure p2;
  procedure p3;
  procedure p4;
  procedure p5;
  procedure p6;
  -- procedure p7(g_id in INTEGER, g_dataType in INTEGER);
END pkg_handle;
/

CREATE OR REPLACE PACKAGE BODY pkg_handle IS
	
  procedure p1 is
  begin
     HANDLE := UTL_FILE.fopen('ORADIR_HY','in.txt','r',500);
	 g_id := HANDLE.id;
	 g_dataType := HANDLE.dataType;
     g_byteMode := HANDLE.byte_mode;
     exception when others then
     DBMS_OUTPUT.PUT_LINE(sqlerrm);
   end;
   
   
--BYTE_MODE := false;    成功打开
procedure p2 is
  begin
    HANDLE.id := g_id;
	HANDLE.dataType := g_dataType;
	HANDLE.BYTE_MODE := false;
	i := utl_file.fgetpos(HANDLE);
    DBMS_OUTPUT.PUT_LINE('HANDLE t1.txt已经被打开,pos := '||i);
  end;

--BYTE_MODE := true;   操作错误
procedure p3 is
  begin
    HANDLE.id := g_id;
	HANDLE.dataType := g_dataType;
	HANDLE.BYTE_MODE := true;
	i := utl_file.fgetpos(HANDLE);
    DBMS_OUTPUT.PUT_LINE('HANDLE t1.txt已经被打开,pos := '||i);
  end;

--BYTE_MODE 未初始化  成功打开  
procedure p4 is
  begin
    HANDLE_NOTINIT.id := g_id;
	HANDLE_NOTINIT.dataType := g_dataType;
	-- HANDLE.BYTE_MODE := true;
	i := utl_file.fgetpos(HANDLE_NOTINIT);
    DBMS_OUTPUT.PUT_LINE('HANDLE_NOTINIT t1.txt已经被打开,pos := '||i);
  end;

--BYTE_MODE := NULL   成功打开
procedure p5 is
  begin
    HANDLE.id := g_id;
	HANDLE.dataType := g_dataType;
	HANDLE.BYTE_MODE := null;
	i := utl_file.fgetpos(HANDLE);
    DBMS_OUTPUT.PUT_LINE('HANDLE t1.txt已经被打开,pos := '||i);
  end;

--BYTE_MODE := NULL  但id错误 违反安全性
procedure p6 is
  begin
    HANDLE.id := 11;
	HANDLE.dataType := g_dataType;
	HANDLE.BYTE_MODE := null;
	i := utl_file.fgetpos(HANDLE);
    DBMS_OUTPUT.PUT_LINE('HANDLE t1.txt已经被打开,pos := '||i);
  end;


END pkg_handle;
/	

call pkg_handle.p1();
call pkg_handle.p2();
call pkg_handle.p3();
call pkg_handle.p4();
call pkg_handle.p5();
call pkg_handle.p6();

SQL&gt;
SQL&gt; call pkg_handle.p1();

调用完成。

SQL&gt; call pkg_handle.p2();
HANDLE t1.txt已经被打开,pos := 0

调用完成。

SQL&gt; call pkg_handle.p3();
call pkg_handle.p3()
     *
第 1 行出现错误:
ORA-29283: 无效的文件操作
ORA-06512: 在 "SYS.UTL_FILE", line 1273
ORA-06512: 在 "SYS.PKG_HANDLE", line 30


SQL&gt; call pkg_handle.p4();
HANDLE_NOTINIT t1.txt已经被打开,pos := 0

调用完成。

SQL&gt; call pkg_handle.p5();
HANDLE t1.txt已经被打开,pos := 0

调用完成。

SQL&gt; call pkg_handle.p6();
call pkg_handle.p6()
     *
第 1 行出现错误:
ORA-53203: 违反安全性
ORA-06512: 在 "SYS.UTL_FILE", line 332
ORA-06512: 在 "SYS.UTL_FILE", line 1275
ORA-06512: 在 "SYS.PKG_HANDLE", line 60


```

同时读写

```
SQL&gt; set serverout on;
SQL&gt; DECLARE
  2      readfile     UTL_FILE.file_type;
  3      writefile    UTL_FILE.file_type;
  4      vnewline     VARCHAR2(200);
  5      i            PLS_INTEGER;
  6  BEGIN
  7      readfile := UTL_FILE.fopen ('ORADIR_HY', 'in.txt', 'r');
  8      UTL_FILE.get_line (readfile, vnewline);
  9      DBMS_OUTPUT.put_line ('vnewline:'||vnewline);
 10      i := UTL_FILE.fgetpos (readfile);
 11      DBMS_OUTPUT.put_line ('readfile:'||TO_CHAR (i));
 12
 13      writefile := UTL_FILE.fopen ('ORADIR_HY', 'in.txt', 'a');
 14      UTL_FILE.PUT_LINE(writefile, vnewline);
 15      i := UTL_FILE.fgetpos (writefile);
 16      DBMS_OUTPUT.put_line ('writefile:'||TO_CHAR (i));
 17  END ;
 18  /
vnewline:11111111111111111111111111
readfile:27
writefile:0

```

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

## Attachments:

[image2023-10-17_16-25-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTE4OTcwYzJhZjRmNTIxM2JiIiwicmVmX2lkIjoiNjczOTZkOTE3MjgyMDZlZmI5MmYyMDkxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5ODA5LCJleHAiOjE3ODIzOTYyMDl9.XIWYk4AhIRCPr08FCpve6trm976Mj7TJxti2Q7bQMu4)

 (image/png)    
