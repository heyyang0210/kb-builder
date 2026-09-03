Created by 王海峰, last modified by  未知用户 (liaofeng) on 十月 17, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#1-overview%E6%A6%82%E8%BF%B0)  

**简介 **   utl_file为PL/SQL提供了读写操作系统文件的能力。在PL/SQL中通过FOPEN获取到文件句柄后，就可以通过PUT、GET_LINE、PUT_LINE等函数实现对文件做读写的操作，通过FCLOSE关闭文件。

         由文件名也可以直接对文件做重命名、删除的操作。

参考：    [UTL_FILE和linux系统文件函数的差别 - 蔡思南 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107390518)  

  [           https://docs.oracle.com/database/121/ARPLS/u_file.htm#ARPLS70901](https://docs.oracle.com/database/121/ARPLS/u_file.htm#ARPLS70901)  

  


1） 是否要有二进制 ab wb rb

2)    location的兼容性

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

- UTL_FILE.FILE_TYPE   :    TYPE file_type IS RECORD (id BINARY_INTEGER, datatype BINARY_INTEGER, byte_mode BOOLEAN);


  


|函数名|参数|特性|报错情况|
|---|---|---|---|
|F_OPEN|Location IN VARCHAR2,  ** ' 以/开头'**,Filename IN VARCHAR2,,Open_mode IN VARCHAR2,,Max_linesize IN INT,返回值：文件句柄|打开文件，获取对文件操作的文件句柄,a: 追加打开,w:写打开（清空之前文件之后打开）,r:读打开,- 注意 max_lineSize的长度在1-32767， 默认为1024
- 注意： 对于ab、wb、rb三种打开方式，目前禁掉
|INVALID_MAXILINESIZE     —  入参max_lineSize不在1-oracle: 32767    **(yasdb: 32000)**,INVALID_MODE      — 不是用a w r ab wb rb方式打开,INVALID_OPERATION   — 以r或者rb打开时候，无效的文件路径，不存在的文       'ta.txt'                                 件或路径,INVALID_PATH  – location无效,INVALID_FILENAME   – 文件名为空 null  ''|
|IS_OPEN|file IN FILE_TYPE,返回值：文件是否打开的boolean值|看当前文件的文件句柄是否打开（有效）,/将handle的另外参数改一下，看下是不是还能正常判断|INVALID_FILEHANDLE   — 当前filehandle不在维护的filkeHandle list中,open -close  、all-isopen试下|
|FCLOSE|file IN   OUT   FILE_TYPE|关闭文件|WRITE_ERROR    --当前文件执行写磁盘的时候，close文件会报错,  
|
|FCLOSE_ALL|无|关闭当前session下的所有文件|WRITE_ERROR     --当前文件执行写磁盘的时候，close文件会报错    
    
  /***是全部关闭，还是关闭部分报错|
|F_COPY|src_location    IN VARCHAR2,    
  src_filename  IN VARCHAR2,    
  dest_location  IN VARCHAR2,    
  dest_filename IN VARCHAR2,    
  start_line         IN BINARY_INTEGER DEFAULT 1,    
  end_line          IN BINARY_INTEGER DEFAULT NULL|从源地址复制文件到目标地址|INVALID_FILENAME ,INVALID_PATH,INVALID_OPERATION --无效操作，比如调用系统函数错误时候发生,INVALID_OFFSET    — start_line不在有效范围内， 以及start_line不能转成int类型,READ_ERROR    — endline>文件总行数,**WRITE_ERROR**       **— 在执行的时候发生操作系统错误**|
|FFLUSH|file IN FILE_TYPE|从系统缓冲区将数据刷盘到操作系统|INVALID_FILENAME,INVALID_OPERATION,WRITE_ERROR|
|FGETATTR|location IN VARCHAR2,    
  filename IN VARCHAR2,    
  fexists OUT BOOLEAN,    
  file_length OUT NUMBER,    
  block_size OUT BINARY_INTEGER|获取当前文件的属性|INVALID_PATH,INVALID_FILENAME – 文件名为空,INVALID_OPERATION – 不存在文件路径,READ_ERROR  ,ACCESS_DENIED – 为什么open没有拒绝|
|FREMOVE|location IN VARCHAR2,    
  filename IN VARCHAR2|删除文件|  `ACCESS_DENIED  `  ,  `DELETE_FAILED  --- windows操作系统下，一个session在写，另一个 session执行remove会发生删除失败`  ,  `INVALID_FILENAME`  ,  `INVALID_OPERATION`  ,  `INVALID_PATH`  |
|FRENAME|src_location   IN VARCHAR2,    
  src_filename  IN VARCHAR2,    
  dest_location  IN VARCHAR2,    
  dest_filename IN VARCHAR2,    
  overwrite        IN BOOLEAN DEFAULT FALSE|重命名文件|  `ACCESS_DENIED`  ,  `INVALID_FILENAME`  ,  `INVALID_PATH`  ,  `RENAME_FAILED`  |
|FSEEK|file             IN OUT  UTL_FILE.FILE_TYPE,absolute_offset  IN      INTEGER DEFAULT NULL,relative_offset  IN      INTEGER DEFAULT NULL|设置读文件的偏移地址|  `INVALID_FILEHANDLE`  ,  `INVALID_OFFSET   -- offset无效的偏移地址，<0`  ,  `INVALID_OPERATION`  ,  `READ_ERROR  `  |
|GET_LINE|file      IN      FILE_TYPE,    
  buffer OUT  VARCHAR2,    
  len      IN     INTEGER DEFAULT NULL|从以r方式打开的文件中获取一行|  `INVALID_FILEHANDLE`  ,  `INVALID_OPERATION`  ,INVALID_MAXLINESIZE  —,  `NO_DATA_FOUND  --文件是空`  ,  `READ_ERROR --已经读到文件末尾，还在执行读操作`  |
|PUT_LINE|file          IN FILE_TYPE,    
  buffer      IN VARCHAR2,    
  autoflush  IN BOOLEAN DEFAULT FALSE|输出一行到以w或者a打开的文件中|  `INVALID_FILEHANDLE`  ,INVALID_MAXLINESIZE  —,  `INVALID_OPERATION`  ,  `WRITE_ERROR  --- 要写入的数据>open时候设置的一行最大长度`  |
|PUT|file IN FILE_TYPE,buffer IN VARCHAR2|和NEW_LINE搭配使用，PUT 加 NEW_LINE 相当于 PUT_LINE|  `INVALID_FILEHANDLE`  ,INVALID_MAXLINESIZE  —,  `INVALID_OPERATION`  ,  `WRITE_ERROR   ----- 要写入的数据>open时候设置的一行最大长度`  |
|NEW_LINE|file     IN FILE_TYPE,    
  lines   IN BINARY_INTEGER := 1|输出换行符到文件|  `INVALID_FILEHANDLE`  ,  `INVALID_OPERATION`  ,  `WRITE_ERROR ----- 要写入的数据>open时候设置的一行最大长度`  |
|GET_RAW|file   IN  UTL_FILE.FILE_TYPE,     
  buffer     OUT NOCOPY  RAW,len      IN    PLS_INTEGER DEFAULT NULL|从文件中获取 len 个字节的数据，对换行符不敏感|  
,  `INVALID_FILEHANDLE`  ,  
,  `INVALID_OPERATION`  ,  
,  `LENGTH_MISMATCH`  ,  
,  `NO_DATA_FOUND`  ,  
,  `READ_ERROR  `  ,  
|
|PUT_RAW|file   IN  UTL_FILE.FILE_TYPE,     
  buffer     OUT NOCOPY  RAW,autoflush  IN  BOOLEAN DEFAULT FALSE|输出buffer里的数据到文件中|  `INVALID_FILEHANDLE`  ,  `INVALID_OPERATION`  ,  `WRITE_ERROR `  |
|FGETPOS|UTL_FILE.FGETPOS ( file IN FILE_TYPE), RETURN INTEGER;,  
|获取当前文件  指针所在的偏移位置，以字节为单位。返回值为INTEGER类型。|INVALID_FILEHANDLE ：入参file是未打开或未被赋值的文件句柄    
  INVALID_OPERATION ：当文件的打开模式是二进制打开的（但目前为止yas本身并不支持二进制打开模式，所以暂时不会在fgetpos中出现此错误。）    
  READ_ERROR：  【暂时未找到报此错误的原因】|
|  
|  
|  
|  
|
|  
|  
|  
|  
|


  


一些分类：

![](https://pingcode.yasdb.com/atlas/files/public/67396d93a1ad9a3311dc924e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio)

如果以写打开，不能调用读打开的函数比如FSEEK、 F_GETLINE

如果以读打开，不能调用以写打开的函数，比如PUT、PUT_LINE等

##   [3](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#3-interfaces%E6%8E%A5%E5%8F%A3)      [. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


       UTL_FILE的I/O功能类似于标准的操作系统流文件I/O，但有一些限制。比如：通过调用FOPEN返回文件句柄，在后续的操作中使用该文件句柄调用GET_LINE或者PUT_LINE等操作完成对文件的I/O。完成之后，调用FCLOSE释放资源。



|报错名|描述|
|---|---|
|INVALID_PATH|文件路径不存在|
|INVALID_MODE|文件打开模式不对，UTL_FILE目前只提供了6种文件打开的方式。|
|INVALID_FILEHANDLE|文件句柄无效|
|INVALID_OPERATION|比如用写方式打开，在读文件的时候会报错误。|
|READ_ERROR|- 设置的读缓冲太小(max_linesize小于中该行的长度)
- 或者在读取文件时候发生了操作系统错误--已经读到文件末尾还在持续读
|
|WRITE_ERROR|文件写入错误，,在文件写入时候，另一个线程执行close操作，会发生写入错误|
|INTERNAL_ERROR|  
|
|CHARSETMISMATCH|比如文件是以FOPEN_NCHAR的方式打开，但是之后的I/O操作使用的是PUT_LINE或者GET_LINE,|
|FILE_OPEN|  
|
|INVALID_MAXLINESIZE|无效的max_lize长度，  ***正确长度1-32767***  ，默认1024， 不在这个范围会报错|
|INVALID_FILENAME|无效的文件名|
|ACCESS_DENIED|文件拒绝被访问。|
|INVALID_OFFSET|无效的偏移地址。,使用lseek设置偏移地址的时候，偏移地址<0|
|DELETE_FAILED|删除失败。                       --windows平台上报错|
|RENAME_FAILED|重命名失败。                   --windows平台报错|


  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

结构体设计：

放一个  **utlFIleNodeList *utlFileList**   在AnlHandler handler->inst上 

```
typedef Struct StUtlFIleNode{       
     int fileHandle;   -- 在ffcloseAll以及IS_OPEN的校验中需要     
     CodBytes lineBuf;  --在getLine  GET_RAW  PUT PUT_LINE中需要 
     int maxLineSize;  --在getLine  GET_RAW  PUT PUT_LINE中需要 
     int offset;    -- 在fseek时候设置，在getLine时候用到
     int fileType;       
     int openMode;
     struct FileNode* next;
} UtlFileNode;

typedef Struct StUtlFIleNodeList{     
        UtlFIleNOde *node;
        int count;
}UtlFileNOdeList;
```

  


## 5.1 函数流程图

![](https://pingcode.yasdb.com/atlas/files/public/67396d93a1ad9a3311dc924f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio)

## 5.2 函数实现具体思路

  


|函数名|UTL_FILE|注意点|意见校验|意见|实现方法|
|---|---|---|---|---|---|
|F_COPY|参数：源文件路径、源文件名字、目标文件目录、目标文件名字、起始行、终止行,无返回值,  
,  
|  
|  
|参考linux shell的cp命令内核源码实现|循环调用,fgets(fd, buf ,n ),和fputs,  
|
|F_GETATTR|参数：文件目录，文件名，ifexsist，filelength, blockSize,  
|  
|与lineSize没有关系，似乎与不同操作系统平台有关。在windows上都显示为0，在linux上都显示为4096|（1）构造用例在oracle调研blockSize的行为|lseek(fd, 0, SEEK_END),fexists -   int access(const char* pathname, int mode);,  
|
|F_REMOVE|参数：文件目录，文件名,无返回值|  
|![](https://pingcode.yasdb.com/atlas/files/public/67396d93a1ad9a3311dc9250/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio),1) ,2）异常处理分支是☞？|（1）失败情况下errno要记录下来,（2）调研oracle在文件已删除情况下再次删除是否会进入异常处理分支|remove(dir+fileName)|
|F_RENAME|  
|  
|  
|有测试点，需要测试覆盖并发打开，进行rename的场景|拼接dir+filename， 生成pathname，调用rename(old, new);|
|IS_OPEN|参数：文件句柄,返回值：BOOL|  
|```
declare
   HANDLE UTL_FILE.FILE_TYPE;
   begin
     HANDLE := UTL_FILE.fopen('PLSQLDIR','t1.txt','r',500);
	 DBMS_OUTPUT.PUT_LINE('begin');
	 DBMS_OUTPUT.PUT_LINE(HANDLE.id);
	 DBMS_OUTPUT.PUT_LINE(HANDLE.dataType);
	 
		 
     UTL_FILE.fremove('PLSQLDIR','t2.txt');
	 exception when others then
     DBMS_OUTPUT.PUT_LINE(sqlerrm);
   end;
/  

declare
  HANDLE UTL_FILE.FILE_TYPE;
  begin
     HANDLE.id := 1995950200;
	 HANDLE.dataType := 1;
	 IF UTL_FILE.is_open(HANDLE) THEN
        DBMS_OUTPUT.PUT_LINE('HANDLE F:\csn_temp_file\t1.txt已经被打开');
    ELSE
        HANDLE := UTL_FILE.fopen('PLSQLDIR','t2.txt','r',500);
        DBMS_OUTPUT.PUT_LINE('HANDLE OPEN FILE');
    END IF;
   end;
   /
```,最终在另一个session可以成功打开handle, 但是oracle声明不保证这种操作的安全性和正确性,![](https://pingcode.yasdb.com/atlas/files/public/67396d938970c2af4f5213de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio),![](https://conf.yasdb.com/download/attachments/107390518/image2023-4-21_16-44-37.png?version=1&modificationDate=1682066678011&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio)|确定是SESSION级别的IS_OPEN，让测试覆盖|在当前session维护的filehandleList中遍历一遍， 如果能找到的话，是不是还需要去确定在系统中是不是已经打开？|
|F_OPEN|参数：,Location IN VARCHAR2,,Filename IN VARCHAR2,,Open_mode IN VARCHAR2,,Max_linesize IN INT,返回值：一个FILE_TYPE的文件句柄,  
,FILE_TYPE： ,id:文件描述符,datatype:文件是char/nchar或者二进制文件,byte_mode: 文件打开方式是以二进制文件还是以text file打开                        ,  
,参数中：其中location是一个大写的文件路径代号，可以通过视图查找到，与filename可以拼接成文件路径,  
,max_lineSize: 一行的最大长度，写的时候的一行不可以超过max_lineSize, 读的时候从文件读出的内容也不可以超过max_lineSize，否则会报错,  
|1. F_OPEN的open_mode有ab wb rb三种形式，没有以rw打开的方式
,     open函数中没有按照  二进制文件  打开的这种,  
,   2. F_OPEN返回值是一个文件结构的指针，除了filehandle之外还包括文件以什么模式打开datatype和当前文件是什么类型type_mode（  主要区分二进制文件  ）,  ，open返回的是一个文件描述符,  
,3.高级包多了一个maxlize的选项，假如此时要文件实际的一行的长度 或者实际要写入文件的一行的长度   > max_linesize，会报错  。|  
|（1）文件本身的属性怎么得到的，要细化。,（2）datatype和filetype，字符串方式还是二进制方式有正交组合的场景需要调研覆盖；,（3）工作量不大的话建议支持|需要先查询文件的属性，本身是char/nchar/二进制（.bin文件）等,判断文件的属性和打开的属性是不是一致，不一致则报错,  
,如果是以w打开：,     O_WRONLY | O_TRUNC,如果是以a方式打开：,      O_WRONLY | O_APPEND,如果是以读方式打开：,      O_RDONLY,  
,wb：,ab：,rb：,可以正常打开，但是二进制的读取在高级包中需要,调用GET_RAW和PUT_RAW，所以是否需要实现？,  
,,|
|F_CLOSE|参数： handle|  
|  
|没有返回值怎么处理失败场景，调研oracle处理|close(fd)|
|F_CLOSEALL|  
|  
|  
|  
|将当前fd记录到handle上，以二叉树的形式存储起来，fclose_all的时候调用close|
|GET_LINE|参数：filehandle, 存储读入的buffer, 读取的长度size,buffer中存的是文件中一行的长度，size默认值是max_lineSize;,如果文件中一行>open时候设置的长度max_linesize， 就会报错|高级包中多了一个报错情况：,假如文件读到的一行的长度>open时候设置的长度，|按照字节：,测试场景：, 文件中一行写入5给英文, 接下来一行写入5个中文，设置一行长度为8，最终在读第二行中文时候报错,  
,说明是按照字节|确定max_linesize限定字节还是字符|get_line要获取的是一行，,在open时候创建两个缓冲区：maxLineSize的readbuffer和maxLineSize的writeBuffer,在lseek之后，文件读指针已经指向offset，调用,read(fd, readbuf, offset, max_lineSize)，,从readBuffer中读取n bytes到buf, 如果遇到换行符直接输出；如果遇到换行符都还没有达到n bytes， 就报错”文件读取错误“; 如果n > buf的长度，也需要报错,  
|
|F_SEEK|参数：fileHandle， 绝对偏移，相对偏移,  
|对于高级包，如果使用绝对偏移，将跳转的状态设置为SEEK_SET; 如果是相对偏移，将状态设置为SEEK_CUR。,  
|  
|  
|对于高级包，如果使用绝对偏移，将跳转的状态设置为SEEK_SET; 如果是相对偏移，将状态设置为SEEK_CUR。|
|PUT|参数：filehandle, 以及缓冲buf ,,无返回值。,  
,配合new_line使用，将buf中的数据缓冲到一块空间，在最终加上new_line的时候会判断当前的长度是不是>fopen时候设置的一行长度，如果>则报错。,（注意即使原始数据中有换行符，最终写入数据时候也是用new_line的来作为真正的换行符）|1.PUT没有write的n , 它最终输出的长度是buf的实际长度， 避免了write写入乱码的情况。,2.PUT不会调用write，是在new_line函数的时候输出到缓冲区，  最终会在flush时候报错  。因为此时识别到一行的长度>open时候指定的maxlinesize,3.PUT_LINE函数和PUT相比多了一个是不是立即flush的选项。,  
|  
|  
|open的时候按照max_lineSIze*2创建一个写缓冲，对于PUT: 一直写到max_lineSIze- 换行符长度都还没有调用NEW_LINE，就报错。,执行PUT_LINE的时候，先检查当前的writeBuffer里面有没有数据，如果有的话，这一行的长度需要加上writeBuffer已有的长度。,如果writebuffer的长度+put_line的长度>max_lineSize, 报错,  
,差异点：oracle是在fflush时候才判断,![](https://pingcode.yasdb.com/atlas/files/public/67396d938970c2af4f5213df/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio),|
|NEW_LINE|参数：fileHandle,无返回值。它表示最终实际写入文件的一行的换行符||  
|  
|  
|
|PUT_LINE|参数：fileHandle,以及缓冲buf, 以及参数表示是否立即刷盘，默认为false||（1）一行写入带有多个换行符的情况；,最终会写入多行,  
,验证下单行+/bn+buffer>max_lineSize|增加调研场景,（1）一行写入带有多个换行符的情况；,最终会写入多行,（2）一行中写入带转义的换行符|  
|
|F_FLUSH|参数：filehandle,将fd对应的系统缓冲区缓冲到文件,无返回值|  
|可以，见上面,但是尝试多几次就会出现,![](https://pingcode.yasdb.com/atlas/files/public/67396d94a1ad9a3311dc9252/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio)|用oracle ,pipeline传一下数据handle,看能不能在另一个session执行flush操作|fdatasync(fd);,??怎么获取到不同的报错情况|
|GET_RAW|参数：fileHandle,buffer， len,len默认是最大值32767|没有换行符的概念，所以对于OPEN时候传入的max_lineSize不会影响这个函数。,在GET_RAW的入参len表示当前需要从文件中读取的字节个数，对于换行符不会做特殊处理|![](https://pingcode.yasdb.com/atlas/files/public/67396d948970c2af4f5213e0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio)|  
|从文件中读取len个字节的数据，将text转为raw类型输出,  
|
|PUT_RAW|参数：fileHandle, buffer， autoFlush,auto FLush：用来控制是不是立马刷新到磁盘|  
|  
|  
|将需要put的raw类型转为text后刷到磁盘|
|FGETOPS|参数：fileHandle,返回值：文件指针相对文件起始位置的偏移值（字节为单位）|同一个文件在Linux和windows系统下偏移值可能不同，因为  windows的换行符是2个，linux的换行符是1个。|  
|  
|去UtlFileNodeList中找入参file所对应的  UtlFileNode  。,找到后  返回UtlFileNode→readOffset。,【yas目前只支持w,r,a，readOffset初始化是0，且只有在read模式下才有可能被修改。与oracle 在w,a模式下FGETOPS返回值的结果都是0的状态正好对齐】,  
,规格限制：,readOffset|


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#54-dfx%E8%AE%BE%E8%AE%A1)  

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#55-%E5%85%B6%E4%BB%96)  

#   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

测试点：

数据：中文符、英文符、

|函数名|单线程测试点|并发测试点|
|---|---|---|
|F_COPY|  
|- sesison1:  往文件一直写入数据/ 一直从文件读数据
,      session2:  F_COPY|
|F_GETATTR|报错情况： 文件路径不存在,  
,测试流程：,  GET_ATTR,  删除/重命名文件,  GET_ATTR|session1 : 删除文件/重命名文件,session2:  GET_ATTR是否成功|
|F_REMOVE|报错情况： 文件路径不存在,  
,  
|- 在  **windows和linux**  操作系统下
-       session1: 写/读文件
-       session2: F_REMOVE
- 预期： windows下执行失败，linux执行成功
,  
|
|F_RENAME|  
|- 在  **windows和linux**  操作系统下
,      session1: 写/读文件,      session2: F_RENAME,预期： windows下执行失败，linux执行成功|
|  
,IS_OPEN|  
|  
|
|F_OPEN|- 以r方式打开，调用PUT 
- 以w方式打开，调用GET_LINE、
- 以rb方式打开，
|  
|
|F_CLOSE|  
,  
|  
|
|F_CLOSEALL|  
|- sesison1:  往文件一直写入数据/ 一直从文件读数据
,      session2:  F_CLOSEALl,预期：执行失败，报写入错误|
|GET_LINE|- 文件一行写入300
,     在F_OPEN中设置长度为|  
|
|F_SEEK|- 设置文件的偏移值为0，-1，1，fileSize-1 ，fileSize，fileSize+1
- 传入空的fileHandle
|  
|
|PUT|- FOPEN以w方式打开，设置max_linesize = 200, PUT一个超过200的数据
- FOPEN以w方式打开，设置max_linesize= 200, 循环PUT 50的数据，并执行NEW_LINE
|  
|
|NEW_LINE|  
|  
|
|PUT_LINE|- FOPEN以w方式打开，设置max_linesize = 200, PUT_LINE一个超过200的数据
- FOPEN以w方式打开，设置max_linesize= 200, 循环PUT_LINE 50的数据，并执行NEW_LINE
|  
|
|F_FLUSH|- PUT_LINE一行数据，不调用fflush. 查看文件内容
- PUT_LINE一行数据，调用fflush, 查看文件内容
,  
,  
|  
|
|F_GETPOS|  
|  
|


  


##   [7.资料设计章节 资料在设计阶段，要识别出来相关需要调整的范围、大纲。](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82-%E8%B5%84%E6%96%99%E5%9C%A8%E8%AE%BE%E8%AE%A1%E9%98%B6%E6%AE%B5%E8%A6%81%E8%AF%86%E5%88%AB%E5%87%BA%E6%9D%A5%E7%9B%B8%E5%85%B3%E9%9C%80%E8%A6%81%E8%B0%83%E6%95%B4%E7%9A%84%E8%8C%83%E5%9B%B4%E5%A4%A7%E7%BA%B2)  

##   [8. TODO（遗留问题） *说明本方案遗留的问题或下一步需要解决的问题。*](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941&focusedCommentId=107387218#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98-%E8%AF%B4%E6%98%8E%E6%9C%AC%E6%96%B9%E6%A1%88%E9%81%97%E7%95%99%E7%9A%84%E9%97%AE%E9%A2%98%E6%88%96%E4%B8%8B%E4%B8%80%E6%AD%A5%E9%9C%80%E8%A6%81%E8%A7%A3%E5%86%B3%E7%9A%84%E9%97%AE%E9%A2%98)  

*8.1 FILE_TYPE怎么实现：*

*  两层封装：用record类型封装一层，再传入到C代码中*

  


*8.2 报错怎么做：*

*添加单独判断错误码*

![](https://pingcode.yasdb.com/atlas/files/public/67396d948970c2af4f5213e1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVFBQUFDQUFBQUVnUUFRQUFBQUFFQUFBQ0FBQUFCQUFBQUFBQUFBQUlBQUFBQUFBQUFBQWdBQUFBQUFnQUFBQUFBQUFBQUFxQVNBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQ0FBQUFnQUFJQUFBQUNZSWdJQUFBQUFBSUJBZ0FBQVFBQUFBUUlBQUFBUUFBZ0FBQUFBQVFDQUNBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDkzODIsImV4cCI6MTc4MjMyMDE4Mn0.E7UUDhE2Ec6eOz85bElnDw6SLqPwacXjAkGELzkqzio)

  


  


## Attachments:

[image2023-4-26_17-16-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTM4OTcwYzJhZjRmNTIxM2Q1IiwicmVmX2lkIjoiNjczOTZkOTI1OTNmOTljOWZmMjM3Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzgyLCJleHAiOjE3ODIzOTU3ODJ9.dPj1IxzG84QaXiGG-2q_CRwFm8aXk6ip2EzmjqKx9vs)

 (image/png)    


[image2023-4-26_16-16-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTM4OTcwYzJhZjRmNTIxM2Q3IiwicmVmX2lkIjoiNjczOTZkOTI1OTNmOTljOWZmMjM3Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzgyLCJleHAiOjE3ODIzOTU3ODJ9.VxJxSoGrha8dVYvX_BhX1xHfjE9HtjvokphAwKR6b7M)

 (image/png)    


[image2023-4-26_16-3-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTNhMWFkOWEzMzExZGM5MjQ3IiwicmVmX2lkIjoiNjczOTZkOTI1OTNmOTljOWZmMjM3Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzgyLCJleHAiOjE3ODIzOTU3ODJ9.XqOFtJJiMUcrIbL-hjxcNDQwo19JpFFdV2PHhQeIuwo)

 (image/png)    


[image2023-4-26_16-3-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTNhMWFkOWEzMzExZGM5MjQ4IiwicmVmX2lkIjoiNjczOTZkOTI1OTNmOTljOWZmMjM3Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzgyLCJleHAiOjE3ODIzOTU3ODJ9.1WFQj6aG_b4fbYdCRBCGkvgLmPS_7TkOgdJJ8NRnZy0)

 (image/png)    


[image2023-2-2_9-45-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkOTM4OTcwYzJhZjRmNTIxM2RkIiwicmVmX2lkIjoiNjczOTZkOTI1OTNmOTljOWZmMjM3Y2Y5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5MzgyLCJleHAiOjE3ODIzOTU3ODJ9.UPhGP3eOJffJD7WSdLTIOdDvK9hf-IkNeF_fe-YDIQo)

 (image/png)    
