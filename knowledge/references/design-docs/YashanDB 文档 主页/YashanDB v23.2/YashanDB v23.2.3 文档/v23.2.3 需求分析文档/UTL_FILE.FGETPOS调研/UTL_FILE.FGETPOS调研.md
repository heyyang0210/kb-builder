Created by 邓秋怡, last modified on 十月 17, 2023

#   [YDBRD-18477: utl_file FGETPOS子函数 Research（](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [utl_file FGETPOS子函数](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)      [特性调研）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#ydbrd-xxxx-xxx-researchxxx-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)  

IR链接：    [[YDBRD-18477] 高级包UTL_FILE新增FGETPOS子函数 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-18477)  

  


##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-overview%E6%A6%82%E8%BF%B0)  

oracle utl_file.fgetpos链接：    [PL/SQL Packages and Types Reference (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/database-pl-sql-packages-and-types-reference.pdf#page=4193&zoom=100,0,708)  

|函数|参数|描述|参数说明|返回值|
|:---|:---|:---|:---|:---|
|FGETPOS|file          IN FILE_TYPE,|  
|  
|返回文件指针所在的偏移位置int类型，以字节为单位。|


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

- ## **入参file：**


|入参file|oracle结果|yas结果|  
|
|---|---|---|---|
|空|PLS-00306: 调用 'FGETPOS' 时参数个数或类型错误|YAS-04323 arguments count must be 1|  
|
|显式NULL|ORA-29282: 文件 ID 无效|ERR_CMM_INVALID_FILETYPE|  
|
|非fileType|PLS-00306: 调用 'FGETPOS' 时参数个数或类型错误|ERR_CMM_INVALID_FILETYPE|  
|
|fileType，未初始化|ORA-29282: 文件 ID 无效|ERR_CMM_INVALID_FILETYPE|  
|
|fileType，已初始化但状态为closed|ORA-29282: 文件 ID 无效|ERR_CMM_INVALID_FILETYPE|  
|
|fileType，已初始化且状态为open，但打开模式为二进制（b）打开|ORA-29283: 无效的文件操作|【yas目前不支持ab rb wb的打开类型，所以在FGETPOS中暂时不会出现此错误】|  
|
|fileType，已初始化且状态为open，且打开模式非b类型打开|正常执行|正常执行|  
|


  


- ## **文件可以以a,w,r类型打开，但以a,w打开时，不论文件写到哪个位置，FGETPOS的返回值都是0。**


|测试问题|测试用例|测试结果|  
|
|---|---|---|---|
|以w模式打开。|  
,```
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
```|![](https://pingcode.yasdb.com/atlas/files/public/67396d928970c2af4f5213c9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQVNBQUFBQUFCQUJBQUFBQUFBQUFBRUFLQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUlBQUFBQUFBQUFBQUFBQUFJQUFBQmdBQUFBQUFBRUVBQUFBQUNBQUFBUUFBQUNBQUFBQUFBZ0NBUUlnQUFBQVFDQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk3NzUsImV4cCI6MTc4MjMyMDU3NX0.bkp2AH4WveyNwazYcDfaZGFKbPF2o0cThI5XavJWHrY),![](https://pingcode.yasdb.com/atlas/files/public/67396d928970c2af4f5213cb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQVNBQUFBQUFCQUJBQUFBQUFBQUFBRUFLQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUlBQUFBQUFBQUFBQUFBQUFJQUFBQmdBQUFBQUFBRUVBQUFBQUNBQUFBUUFBQUNBQUFBQUFBZ0NBUUlnQUFBQVFDQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk3NzUsImV4cCI6MTc4MjMyMDU3NX0.bkp2AH4WveyNwazYcDfaZGFKbPF2o0cThI5XavJWHrY)|  
|
|以a模式打开。|  
,```
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
```,  
,  
,  
|![](https://pingcode.yasdb.com/atlas/files/public/67396d928970c2af4f5213cc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQVNBQUFBQUFCQUJBQUFBQUFBQUFBRUFLQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUlBQUFBQUFBQUFBQUFBQUFJQUFBQmdBQUFBQUFBRUVBQUFBQUNBQUFBUUFBQUNBQUFBQUFBZ0NBUUlnQUFBQVFDQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk3NzUsImV4cCI6MTc4MjMyMDU3NX0.bkp2AH4WveyNwazYcDfaZGFKbPF2o0cThI5XavJWHrY),![](https://pingcode.yasdb.com/atlas/files/public/67396d92a1ad9a3311dc923f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQVNBQUFBQUFCQUJBQUFBQUFBQUFBRUFLQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUlBQUFBQUFBQUFBQUFBQUFJQUFBQmdBQUFBQUFBRUVBQUFBQUNBQUFBUUFBQUNBQUFBQUFBZ0NBUUlnQUFBQVFDQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk3NzUsImV4cCI6MTc4MjMyMDU3NX0.bkp2AH4WveyNwazYcDfaZGFKbPF2o0cThI5XavJWHrY)|  
|
|以r模式打开|```
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
```|![](https://pingcode.yasdb.com/atlas/files/public/67396d928970c2af4f5213cd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQVNBQUFBQUFCQUJBQUFBQUFBQUFBRUFLQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUlBQUFBQUFBQUFBQUFBQUFJQUFBQmdBQUFBQUFBRUVBQUFBQUNBQUFBUUFBQUNBQUFBQUFBZ0NBUUlnQUFBQVFDQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk3NzUsImV4cCI6MTc4MjMyMDU3NX0.bkp2AH4WveyNwazYcDfaZGFKbPF2o0cThI5XavJWHrY)|  
|


- ## **linux下的换行符和windows下的换行符所占字节数不同  **    [\r,\n,\r\n的区别 - 小 天 - 博客园 (cnblogs.com)](https://www.cnblogs.com/xiaotiannet/p/3510586.html)    **    【**  **Linux中遇到换行符("\n")会进行回车+换行的操作，回车符反而只会作为控制字符("^M")显示，不发生回车的操作。而windows中要回车符+换行符("\r\n")才会回车+换行，缺少一个控制符或者顺序不对都不能正确的另起一行。**  **】**


##   [3. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

INVALID_FILEHANDLE ：fgetpos未打开或未被赋值的文件句柄    
  INVALID_OPERATION ：当文件的打开模式是二进制打开的（但目前为止yas本身并不支持二进制打开模式，所以暂时不会在fgetpos中出现此错误。）    
  READ_ERROR：  【暂时未找到报此错误的原因】

- **返回值相关：oracle fgetpos返回值直接用的32位截断，并不抛出异常。**


|  
|测试用例|测试结果|
|---|---|---|
|  
|```
--YDBRD-18477  return value bound
DECLARE
    HANDLE_W     UTL_FILE.file_type;
    i           PLS_INTEGER;
BUFFER_W   varchar(31000);
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
    infile     UTL_FILE.file_type;
    vnewline   VARCHAR2 (32000);
    i          number(38) := 0;
    j          number(38);
BEGIN
    infile  := UTL_FILE.fopen ('ORADIR_HY', 'bound1.txt', 'r',32000);

    LOOP
    BEGIN
UTL_FILE.get_line (infile, vnewline,32000);   
        j := i;
        i := UTL_FILE.fgetpos (infile);                   
if(i<0) 
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
```,  
,  
|![](https://pingcode.yasdb.com/atlas/files/public/67396d928970c2af4f5213ce/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQVNBQUFBQUFCQUJBQUFBQUFBQUFBRUFLQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUlBQUFBQUFBQUFBQUFBQUFJQUFBQmdBQUFBQUFBRUVBQUFBQUNBQUFBUUFBQUNBQUFBQUFBZ0NBUUlnQUFBQVFDQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk3NzUsImV4cCI6MTc4MjMyMDU3NX0.bkp2AH4WveyNwazYcDfaZGFKbPF2o0cThI5XavJWHrY)|


  


##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

##   [5. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#5-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


  


## Attachments:

[image2023-10-17_15-9-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTFhMWFkOWEzMzExZGM5MjM3IiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9.CRY6adf3eVt8bHXzPr5QgLKpd4xwb060flQytPFY-TI)

 (image/png)    


[image2023-10-11_16-10-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTFhMWFkOWEzMzExZGM5MjM4IiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9.wU0Ig3_qKojZDQs8Zw9e8rDL_torh4CzV9zAmChNgwE)

 (image/png)    


[image2023-10-11_16-9-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTI4OTcwYzJhZjRmNTIxM2MzIiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9.kyxLTH1vqzprfWomoDQnRHpBner65c5w15FIvYcJUlA)

 (image/png)    


[image2023-10-11_16-8-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTI4OTcwYzJhZjRmNTIxM2M0IiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9.xFe_vO0wvgRrDB6cIBl_2EbP5IUd0jVc8JLR84HyPO8)

 (image/png)    


[image2023-10-11_16-8-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTI4OTcwYzJhZjRmNTIxM2M1IiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9._2Q5OgfMHMFGC11Fs7AE-nVdf6I8p0peF0klXbBatsg)

 (image/png)    


[image2023-10-11_15-55-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTJhMWFkOWEzMzExZGM5MjM5IiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9.VelALmPfg2tjeM6huaxZ2y3OSmh1sxWNerv-0YcPVi0)

 (image/png)    


[image2023-10-11_15-53-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTJhMWFkOWEzMzExZGM5MjNiIiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9.NNbbvOgza7KdccIgBhJuVOrqCgcq5UMolEZ22rbJoyA)

 (image/png)    


[image2023-10-11_15-51-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTI4OTcwYzJhZjRmNTIxM2M3IiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9.uBGplnvhBNka-lyDUpY3JB_i0VlGS2GPUGBbLRR-XuQ)

 (image/png)    


[image2023-4-17_20-15-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTJhMWFkOWEzMzExZGM5MjNkIiwicmVmX2lkIjoiNjczOTZkOTE1OTNmOTljOWZmMjM3Y2UzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5Nzc1LCJleHAiOjE3ODIzOTYxNzV9.k-sk4wUkVoMRh-2o4o745dtfbbjU2vARFRaJAs8aCyk)

 (image/png)    
