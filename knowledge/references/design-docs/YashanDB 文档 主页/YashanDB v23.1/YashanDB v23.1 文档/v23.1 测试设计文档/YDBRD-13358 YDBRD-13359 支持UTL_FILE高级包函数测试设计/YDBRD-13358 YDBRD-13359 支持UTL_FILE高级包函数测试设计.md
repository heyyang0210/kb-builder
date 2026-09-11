Created by 徐瑶, last modified on 十月 31, 2023

# **1. 概述**

本文描述utf_file高级包函数的测试设计;

开发设计：    [UTL_FILE设计-](https://conf.yasdb.com/pages/viewpage.action?pageId=109580185)  

SR：        [YDBRD-13358](https://jira.yasdb.com/browse/YDBRD-13358?src=confmacro)    -  支持UTL_FILE高级包函数  完成

  [YDBRD-13359](https://jira.yasdb.com/browse/YDBRD-13359?src=confmacro)    -  实现UTL_FILE.FCLOSE_ALL函数  完成

# **2. 需求分析**

## 2.1 描述

(1) 支持对操作系统文件操作封装的函数    
  FOPEN    
  IS_OPEN    
  FCLOSE    
  FCOPY    
  FFLUSH    
  FGETATTR    
  FSEEK    
  GET_LINE    
  PUT    
  PUT_LINE    
  NEW_LINE    
  FRENAME    
  FREMOVE    
  FCLOSE_ALL

## 2.2 功能描述

UTL_FILE包为用户提供了读写系统文件的能力，用户可以通过UTL_FILE操作系统文件。

在PL/SQL中通过FOPEN获取到文件句柄后，就可以通过PUT、GET_LINE、PUT_LINE等函数实现对文件做读写的操作，通过FCLOSE关闭文件。

由文件名也可以直接对文件做重命名、删除的操作。

## 2.3 规格限制

（1）因为文件操作必须指定目录，所以  缺省路径为YASDB_DATA（还未设置）  ，然后指定目录需要手动创建。目前数据库并不支持create directory的语法。

（2）基本上在对文件进行读写动作之前都需要先执行fopen打开文件，  通过调用FOPEN返回文件句柄，在后续的操作中使用该文件句柄调用GET_LINE或者PUT_LINE等操作完成对文件的I/O。完成之后，调用FCLOSE释放资源。

（3）一些分类：

![](https://conf.yasdb.com/download/attachments/109580185/image2023-5-15_11-1-4.png?version=1&modificationDate=1684119665000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDcwNDEsImV4cCI6MTc4MjIxNzg0MX0.N_GCURi1HVyAFlzRi-GC5WiGCZDzJON2SCWFrl4emSI)

如果以写打开，不能调用读打开的函数比如FSEEK、 F_GETLINE

如果以读打开，不能调用以写打开的函数，比如PUT、PUT_LINE等

- UTL_FILE.FILE_TYPE     :    TYPE file_type IS RECORD (id BINARY_INTEGER, datatype BINARY_INTEGER, byte_mode BOOLEAN);


  


# **3. 测试设计方法**

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

测试场景：

疑问点：

1、怎么观察handle是否正常释放 --- 反复打开关闭，可能存在handle泄露的问题     yasdb配置参数session

2、

### 3.1 、FOPEN函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|location|- 路径  以 '/'开头， 默认放到 $YASDB_DATA/下
- 路径加文件名长度：1<=路径文件长度<=255
- 文件路径是否带有单/双引号
- 路径大小写
|.代表yasdb_data|1.目录不存在,2.部分目录不存在,3.  不填该参数,4.路径为空,（1）当前径路：./,（2）上层路径：../,（3  ）home路径：~/,（4）绝对路径：/tmp/|INVALID_MAXILINESIZE     —  入参max_lineSize不在1-oracle: 32767      **(yasdb: 32000)**,INVALID_MODE      — 不是用a w r ab wb rb方式打开,INVALID_OPERATION   — 以r或者rb打开时候，无效的文件路径，不存在的文       'ta.txt'                                 件或路径,INVALID_PATH  – location无效,INVALID_FILENAME   – 文件名为空 null  ''|
|  
|filename |- 文件名内容：
,（1）中文,（2）英文（大小写）,（3）数字,（4）特殊字符（含有空格、其它符合终端的目录要求的特殊字符）,- 路径加文件名长度：1<=路径文件长度<=255
- 文件名  是否带有单/双引号
- 反复打开一个文件多次
- 打开大量文件
- 不同文件类型（txt，ini，csv，xls，doc等）
|  
|1.  文件不存在(  以r打开不存在报错，  w,a打开文件不存在会创建）,2.操作用户没有文件的权限：,（1)没有可执行权限,（2没有读写权限,3.文件名为空,4.不填该参数,- 文件名重复配置
|1、文件不存在,2、反复打开同一个文件，观察句柄返回（同session。不同session）,3、打开大量文件（handle规格是多少？）,??内存视图  alloct_mamery|
|  
|open_mode|- 模式覆盖：r 只读/w只写/a 追加,  r/rb，w/wb，a/ab的区别是什么
- 小写
- 大写
- 大小写混合
- 是否带有单/双引号
|  
|1.中文、特殊字符,2.空格,- 除以上六种的其他模式
- 不填该参数
|1、r/rb，w/wb，a/ab的区别是什么，需要正对差异覆盖|
|  
|Max_linesize|- max_lineSize的长度在  1-32000  （边界值）
- 默认为1024
- 省略 
- 0  ，-1，null
- 是否带有单/双引号
- 运算式，包含+-*/
- 嵌套数学函数
|  
|- 超过32000
|  
|
|  
|SESSION_MAX_OPEN_FILE最多支持的打开文件数|在一个会话下默认打开50个文件，最大100个,默认,设置不同的次数|  
|  
|  
|
|  
|  
|  
|  
|参数重复配置|  
|
|遗留问题|SESSION_MAX_OPEN_FILE在一个会话下默认打开50个文件，上限100|  
|  
|  
|  
|


### 3.2 、  IS_OPEN  函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file|- 句柄全大小，全小写，大小写混合
,- 数据类型  为  FILE_TYPE 
- UTL_FILE.FILE_TYPE     :    TYPE file_type IS RECORD (id BINARY_INTEGER, datatype BINARY_INTEGER, byte_mode BOOLEAN);
|  
|拼写错误,无效文件句柄,数据类型错误（char,double，boolean等）|INVALID_FILEHANDLE   — 当前filehandle不在维护的filkeHandle list中,open -close  、all-isopen试下|
|与其他函数组合操作|  
|1、已关闭文件的句柄,2、打开状态的文件句柄,3、正在写操作的文件句柄,4、对文件只有读权限,5、对文件没有读权限,6、在另外的session查询？--什么表现？|  
|  
|  
|


### 3.3 、  CLOSE  函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file|- 句柄全大小，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|还有缓冲数据未写入,拼写错误,无效文件句柄,数据类型错误（char,double，boolean等）,不填该参数|WRITE_ERROR    --当前文件执行写磁盘的时候，close文件会报错,INVALID_FILEHANDLE|
|与其他函数组合操作|  
|1、已关闭的文件句柄,2、正在写入的文件open函数,3、其他session根文件句柄关闭的文件|自定义包|  
|  
|


### 3.4、  CLOSE_ALL  函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确,  
,  
|
|与其他函数组合操作|  
|1.存在部分未关闭的文件；,2.文件全都未关闭,3.  还有缓冲数据未写入|  
|  
|WRITE_ERROR     --当前文件执行写磁盘的时候，close文件会报错    
    
  /***是全部关闭，还是关闭部分报错|


### 3.5 、  F_COPY  函数基本功能：(  将源文件的全部或者部分内容复制到目标文件中。)

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|src_location来源文件的目录名。|- 路径  以 '/'开头， 默认放到 $YASDB_DATA/下
- 路径加文件名长度：1<=路径文件长度<=255
- 文件路径是否带有单/双引号
- 路径大小写
|.代表yasdb_data|1.目录不存在,2.部分目录不存在,3.  不填该参数,4.,（1）当前径路：./,（2）上层路径：../,（3  ）home路径：~/,（4）绝对路径：/tmp/|INVALID_FILENAME ,INVALID_PATH,INVALID_OPERATION --无效操作，比如调用系统函数错误时候发生,INVALID_OFFSET    — start_line不在有效范围内， 以及start_line不能转成int类型,READ_ERROR    — endline>文件总行数,**WRITE_ERROR**       **— 在执行的时候发生操作系统错误**|
|;|src_filename  将要被复制的来源文件|- 文件名内容：
,（1）中文,（2）英文（大小写）,（3）数字,（4）特殊字符（含有空格、其它符合终端的目录要求的特殊字符）,- 文件名为空
- 文件名长度：1<=文件名长度<=255(根据终端类型确定范围)
- 文件名  是否带有单/双引号
|  
|1.  文件不存在,2.操作用户没有文件的权限：,（1)没有可执行权限,（2没有读权限,3.配置多个文件,4.  文件为空|  
|
|  
|dest_location 被创建的目标文件存放的目录名。|- 路径  以 '/'开头， 默认放到 $YASDB_DATA/下
- 路径加文件名长度：1<=路径文件长度<=255
- 文件路径是否带有单/双引号
- 路径大小写
- 与原路径重复
|.代表yasdb_data|1.目录不存在,2.部分目录不存在,3.  不填该参数,4.,（1）当前径路：./,（2）上层路径：../,（3  ）home路径：~/,（4）绝对路径：/tmp/|  
|
|  
|dest_filename 从来源文件创建的目标文件。|- 文件名内容：
,（1）中文,（2）英文（大小写）,（3）数字,（4）特殊字符（含有空格、其它符合终端的目录要求的特殊字符）,- 与  src_filename 文件同名
- 文件名长度：1<=文件名长度<=255(根据终端类型确定范围)
- 文件名  是否带有单/双引号
- 目标文件不存在
- 目标文件已存在
- 源文件和目标文件一样会清空
|  
|1.操作用户没有文件的权限：,（1)没有可执行权限,（2没有写权限,2.文件名为空,3.多个文件,4.文件名重复配置,  
|  
|
|  
|start_line  要复制的内容起始行号|- 1，0
- 小于最大行数的任意行
- null
- 与  end_line相等
- 不填该参数
- 是否带单/双引号
- 运算式，包含+-*/
- 嵌套数学函数
- 大于  end_line
|  
|  
,大于文件最大行数,负数,其他数据类型|可省略|
|  
|end_line 要复制的内容的终止行号|- 小于最大行数的任意行
- 与start_line相等
- null
- 0
- 不填该参数
- 是否带单/双引号
- 运算式，包含+-*/
- 嵌套数学函数
- 小于起始行
- 大于文件最大行数
- 负数
|  
|  
,  
,  
,其他数据类型|可省略|
|  
|  
|  
|  
|省略部分参数，只配置其中一个或多个参数，  如Fcopy（src_location:='a'）,  
|  
|
|与其他函数组合操作|  
|- 目标文件与源文件不同
- 目标文件与源文件相同
- 俩文件均处于关闭状态（  与状态无关
- 目标文件未打开或源文件未打开
- 源文件以只读模式打开，目标文件以只写方式打开
- 文件单行超过32000进行复制，  第一行最后一行超过(预期结果待定）
- 超过32000的行不在复制范围内（从20开始复制，第10行超过32000）
|文件单行超过32000已在本地验证|1.源文件打开模式为w、a，目标文件打开方式为a、r|（源文件以只读模式打开，目标文件以只写方式打开）|
|  
|get_line|- 源文件在做读操作
- 循环读数据
|  
|  
|**先交付linux，windows低优先级交付，需要修改sr范围**|
|  
|put_line(fflush),put、new_line(fflush)|- 源文件在做写操作
- 循环写数据
|  
|  
|  
|
|  
|fgetattr，fcopy|- 复制后查询文件的属性
|  
|  
|  
|
|  
|fcopy，fremove|- 源文件复制后删除
- 删除后复制
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
|


### 3.6、  FGETATTR  函数基本功能：(  获取当前文件的属性)

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|location目录名    
|- 路径  以 '/'开头， 默认放到 $YASDB_DATA/下
- 路径加文件名长度：1<=路径文件长度<=255
- 文件路径是否带有单/双引号
- 路径大小写
|.代表yasdb_data|1.目录不存在,2.部分目录不存在,3.  不填该参数,4.,（1）当前径路：./,（2）上层路径：../,（3  ）home路径：~/,（4）绝对路径：/tmp/|INVALID_PATH,INVALID_FILENAME – 文件名为空,INVALID_OPERATION – 不存在文件路径,READ_ERROR  ,ACCESS_DENIED – 为什么open没有拒绝|
|  
|filename文件名|- 文件名内容：
,（1）中文,（2）英文（大小写）,（3）数字,（4）特殊字符（含有空格、其它符合终端的目录要求的特殊字符）,- 文件名为空
- 文件名长度  ：1<=文件名长度<=64(根据终端类型确定范围)  需确定规格
- 文件名  是否带有单/双引号
- 文件不存在
- 文件没有可执行权限
- 多个文件
|路径加文件名长度共<=255,单个文件名有多长？？64  ,参考oracle,  
|1.操作用户没有文件的权限：,没有读写权限,ACCESS_DENIED,2.文件名重复配置|  
|
|  
|fexists返回的属性1：文件是否存在|数据类型为boolean|  
|数据类型错误（int、char、float、date等）,不填该参数|  
|
|  
|file_length 返回的属性2：文件字节长度|数据类型为number|  
|数据类型错误（int、char、float、date等）,不填该参数|  
|
|  
|block_size文件系统块的字节大小。|数据类型为int|兼容，无实际意义，参数返回值待确认|数据类型错误（number、char、float、date等）,不填该参数|  
|


### 3.7、  FRENAME  函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|src_location 源文件所在的路径|- 路径  以 '/'开头， 默认放到 $YASDB_DATA/下
- 路径加文件名长度：1<=路径文件长度<=255
- 文件路径是否带有单/双引号
- 路径大小写
|.代表yasdb_data|1.目录不存在,2.部分目录不存在,3.  不填该参数,4.,（1）当前径路：./,（2）上层路径：../,（3  ）home路径：~/,（4）绝对路径：/tmp/|  `ACCESS_DENIED`  ,  `INVALID_FILENAME`  ,  `INVALID_PATH`  ,  `RENAME_FAILED--目标文件已存在，省略overwrite`  |
|  
|src_filename 源文件的名字|- 文件名内容：
,（1）中文,（2）英文（大小写）,（3）数字,（4）特殊字符（含有空格、其它符合终端的目录要求的特殊字符）,- 文件名为空
- 文件名长度：1<=文件名长度<=255(根据终端类型确定范围)
- 文件名  是否带有单/双引号
|  
|1.  文件不存在,2.操作用户没有文件的权限：,（1)没有可执行权限,（2没有读权限,3.多个文件,4.文件名重复配置|- 创建一个自定义类型udt，名字和handle一样
- package自定一个type，名字也是handle
- file_type
- select调用
- oracle版本19c
|
|  
|dest_locatio 目标文件所在的路径|- 路径  以 '/'开头， 默认放到 $YASDB_DATA/下
- 路径加文件名长度：1<=路径文件长度<=255
- 文件路径是否带有单/双引号
- 路径大小写
- 与源路径相同
- 与源路径不同
|.代表yasdb_data|1.目录不存在,2.部分目录不存在,3.  不填该参数,4.,（1）当前径路：./,（2）上层路径：../,（3  ）home路径：~/,（4）绝对路径：/tmp/|  
|
|  
|dest_filename 重命名的文件的名字|- 文件名内容：
,（1）中文,（2）英文（大小写）,（3）数字,（4）特殊字符（含有空格、其它符合终端的目录要求的特殊字符）,- 与  源文件同名
- 与其他存在的文件同名
- 文件名长度：1<=文件名长度<=255(根据终端类型确定范围)
- 文件名  带有双引号
- 文件名为空
|  
|操作用户没有文件的权限：,（1)没有可执行权限,（2没有写权限,空格,空串|  
|
|  
|overwrite 如果目标文件已经存在，是否要覆盖|- false/true
- 省略该参数
|  
|操作用户没有源文件的权限：,（1)没有可执行权限,（2没有写权限,操作用户没有目标文件的权限：,（1)没有可执行权限,（2没有写权限,其他字符如0/1,中文等|  
|
|与其他函数组合操作|  
|- 目标文件与源文件不同名
- 目标文件与源文件同名
|与fcopy类似|  
|  
|
|  
|get_line|- 文件在做读数据操作
- 循环读数据
|  
|  
|  
|
|  
|put_line(fflush),put、new_line(fflush)|- 文件在做写操作
- 循环写数据
|  
|  
|  
|
|  
|fgetattr，frename|  
|  
|  
|  
|
|  
|frename，fremove|  
|  
|  
|  
|


### 3.8、  FREMOVE  函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|location 文件所在的路径|- 路径  以 '/'开头
- （1）当前径路：./
- （2）上层路径：../
- （3  ）home路径：~/
- （4）绝对路径：/tmp/
- 路径加文件名长度：1<=路径文件长度<=255
- 文件路径是否带有单/双引号
- 路径大小写
|  
|1.目录不存在,2.部分目录不存在,3.  不填该参数,4.,  
|  `ACCESS_DENIED  `  ,  `DELETE_FAILED  --- windows操作系统下，一个session在写，另一个 session执行remove会发生删除失败`  ,  `INVALID_FILENAME`  ,  `INVALID_OPERATION`  ,  `INVALID_PATH`  |
|  
|filename 文件的名字|- 文件名内容：
,（1）中文,（2）英文（大小写）,（3）数字,（4）特殊字符（含有空格、其它符合终端的目录要求的特殊字符）,- 文件名为空
- 文件名长度：1<=文件名长度<=255(根据终端类型确定范围)
- 文件名  是否带有单/双引号
|  
|1.  文件不存在,2.操作用户没有文件的权限：,（1)没有可执行权限,（2没有读写权限,- 多个文件  (报错：arguments count should be 2)
- 文件名重复配置  (报错：arguments count should be 2)
|  
|
|与其他函数组合操作|  
|- 文件处于关闭、打开状态
- 文件以不同模式打开
|  
|  
|  
|
|  
|get_line|- 文件在做读数据操作
- 循环读数据
|  
|  
|  
|
|  
|put_line(fflush),put、new_line(fflush)|- 文件在做写操作
- 还有缓冲数据未写入
- 循环写数据
|  
|  
|  
|
|  
|fgetattr，fremove|  
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
|


### 3.9、  FSEEK  函数基本功能：(  设置读文件的偏移地址)

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file |- 句柄全大小，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|拼写错误,无效文件句柄,数据类型错误（char,double，boolean等）,不填该参数,  
|  `INVALID_FILEHANDLE`  ,  `INVALID_OFFSET   -- offset无效的偏移地址，<0`  ,  `INVALID_OPERATION`  ,  `READ_ERROR`  |
|  
|absolute_offset  要查找的绝对位置|默认（null）,0,小于文件内容最大长度的任意值,等于文件内容最大长度,运算式，包含+-*/,嵌套数学函数|两个参数不组合,absolute优先级高|负数,大于文件内容最大长度,大于  Max_linesize,省略该参数|  
|
|  
|relative_offset  向前（正）或向后（负）查找的字节数,(有绝对路径时候取出的数据取决于绝对路径，绝对路径为null时候才由curr + 相对路径决定)|- absolute_offset不为null时
,负数,0,正数,null（默认）,空字符串,运算式，包含+-*/,嵌套数学函数,- absolute_offset为null时
,负数,0,正数，（+curr小于文件内容最大长度）,null（默认）,空字符串,运算式，包含+-*/,嵌套数学函数|如果curr - 相对偏移 < 0 , 会将curr置为0 ； 如果curr + 相对偏移 > end , 则会报错|省略该参数,absolute_offset为nul，  正数，+curr大于文件内容最大长度|  
|
|与其他函数组合操作|  
|- 文件处于关闭、打开状态
- 文件打开模式为r
|  
|文件打开方式为w，a|  
|
|  
|get_line|- 文件在做读数据操作
- 循环读数据
|  
|  
|  
|
|  
|put_line(fflush),put、new_line(fflush)|- 文件在做写操作  （报错）
- 循环写数据
|  
|  
|  
|


### 3.10、  GET_LINE  函数基本功能：(  从一个打开的文件中读取一行文本)

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file |- 句柄全大小，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|拼写错误,无效文件句柄,数据类型错误（char,double，boolean等）,不填该参数|  `INVALID_FILEHANDLE`  ,  `INVALID_OPERATION`  ,INVALID_MAXLINESIZE  —,  `NO_DATA_FOUND  --文件是空`  ,  `READ_ERROR --已经读到文件末尾，还在执行读操作`  |
|  
|buffer 存储读取的Buff    
|覆盖 全大小，全小写，大小写混合,数据类型为varchar2,数据类型为varchar，char|  
|超过数据类型限制的长度,数据类型错误（int、boolean、float、date等）,空格,空串|  
|
|  
|len实际读取长度     
    
|正数，小于文件中一行的长度,0,null（默认）,负数,不设置该参数,运算式，包含+-*/,嵌套数学函数|Max_linesize、len、偏移到换行符的实际长度取最小值|大于文件中一行的长度,其他字符中文，英文|  
|
|与其他函数组合|fopen|- 打开模式为r
- 实际文件内容长度小于Max_linesize
|  
|打开模式为w、a|  
|
|  
|fseek|- 设置absolute_offset，relative_offset读取
- 同时读多个文件
- 同一个文件循环读取
- 不同的文件循环读取
- 读取的文件为空/非空
|  
|  
|  
|
|  
|PUT_LINE，put|- 设置一个handle读取一个文件，并将读取的数据写到另一个文件去
- 循环读取一个文件，并将读取的数据写到另一个文件去
- 设置不同的handle读取不同的文件，并将读取的数据写到另一个文件去
|  
|  
|  
|


### 3.11、  FFLUSH  函数基本功能：(  强制将缓冲的数据写入文件。)

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file|- 句柄全大小，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|拼写错误,无效文件句柄,数据类型错误（char,double，boolean等）,不填该参数|INVALID_FILENAME,INVALID_OPERATION,WRITE_ERROR|


### 3.12、PU  T_LINE  函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file |- 句柄全大小，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|拼写错误,无效文件句柄,数据类型错误（char,double，boolean等）,不填该参数|  `INVALID_FILEHANDLE`  ,INVALID_MAXLINESIZE  —,  `INVALID_OPERATION`  ,  `WRITE_ERROR  --- 要写入的数据>open时候设置的一行最大长度`  |
|  
|buffer 存储读取的Buff    
|覆盖 全大小，全小写，大小写混合,数据类型为varchar2,数据类型为varchar，char,  
,  
|  
|超过数据类型限制的长度,数据类型错误（int、boolean、float、date等）,空格,空串|  
|
|  
|autoflush  用于表示在写之后是否立即刷到磁盘，默认是false    
|数据类型为boolean,循环写入设置false/true,省略该参数|注意true和false的区别,（  autoflush指定为true，那么每次都会写一行然后刷盘一行，否则会先写到缓冲块中再一起刷盘）,  
|数据类型错误（int、char、float、date等）,其他字符如0/1,中文等|  
|
|与其他函数组合|fopen|- 打开模式为w，a
- 待写入内容长度小于Max_linesize
- 待写入内容包含中文、英文、数字、特殊字符等
- 待写入内容包括ascii
- 待写入的内容为空
- for循环不停putline
- 待写入的文件为空/非空
- 不同的内容写入同一个文件  （多个buffer
- 同时写入多个文件（相同的内容，不同的内容）
- 写入大量数据
|换行符也占字符，占1个字符  不同文本结束符,w清空文件重写，  a追加写|打开模式为r,待写入内容长度大于Max_linesize,待写入内容长度等于Max_linesize|  
|
|  
|fflush|- 对一个文件写数据，不调用fflush查看文件内容  （无法写入
- 对一个文件写数据，调用fflush, 查看文件内容
- 对不同的文件写数据，部分文件调用fflush，部分不调用
- 写入内容很多超过缓冲区大小，不调用fflush（能写入）
- 数据量很少的时候如1字节能否写进去
- close后再调用fflush刷缓存数据
- 调fflush过程中进行close
|写入内容很多超过缓冲区大小，不调用fflush也能写入,buffer大小？？,  
|  
|  
|


### 3.13、PU  T  函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file |- 句柄全大小，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|拼写错误,无效文件句柄,数据类型错误（char,double，boolean等）,不填该参数|  `INVALID_FILEHANDLE`  ,INVALID_MAXLINESIZE  —,  `INVALID_OPERATION`  ,  `WRITE_ERROR   ----- 要写入的数据>open时候设置的一行最大长度`  |
|  
|buffer 存储读取的Buff    
|覆盖 全大小，全小写，大小写混合,数据类型为varchar2,数据类型为varchar，char,  
|  
|超过数据类型限制的长度,数据类型错误（int、boolean、float、date等）,空格,空串|  
|
|与其他函数组合|fopen|- 打开模式为w，a
- 实际待写入内容长度小于  Max_linesize（字节）
- 待写入内容包含中文、英文、数字、特殊字符等
- 循环写入（执行new_line,  不执行new_line（拼接，直至超过最大长度）  )
- 待写入的文件为空/非空
- 不同的内容写入同一个文件
- 同时写入多个文件（相同的内容，不同的内容）
- 写入大量数据
- put的内容包括，1字节，超大字节，调用fflush能否写入
|  
|打开模式为r,put的内容长度超过  Max_linesize,put的内容长度等于Max_linesize|  
|
|  
|fflush|- 对一个文件写数据，不调用fflush查看文件内容  （无法写入
- 对一个文件写数据，调用fflush, 查看文件内容
- 对不同的文件写数据，部分文件调用fflush，部分不调用
|put+new_line不会将数据写入到文件中，加fllush才会写入|  
|  
|
|  
|put+new_line,put+fclose,put+new_line+fflush,put+new_line+fclose,put+new_line+fflush+fclose|实际待写入内容长度小于Max_linesize|  
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


### 3.14、NEW_LINE函数基本功能：

|输入条件1|输入条件2|有效等价类|备注|无效等价类|对应错误码汇总|
|:---|:---|:---|:---|:---|:---|
|函数关键字检验|函数名称|覆盖 全大小，全小写，大小写混合|  
|覆盖关键字缺失，拼写错误|报错，提示正确|
|入参校验|file |- 句柄全大小，全小写，大小写混合
- 数据类型  为  FILE_TYPE 
|  
|拼写错误,无效文件句柄,数据类型错误（char,double，boolean等）,不填该参数|  `INVALID_FILEHANDLE`  ,  `INVALID_OPERATION`  ,  `WRITE_ERROR ----- 要写入的数据>open时候设置的一行最大长度`  |
|  
|lines|0，null,省略,负数,最大有无限制，与put内容加起来不  超过Max_linesize|  
|大于Max_linesize,空格|  
|
|与其他函数组合|fopen|- 打开模式为w，a
- 实际文件内容长度小于Max_linesize
|  
|打开模式为r、a,待写入内容大于  Max_linesize|  
|
|  
|putline+newline|与putline内容加起来不  超过Max_linesize|  
|  
|  
|


## 可能产生的异常

**用plsql  exception分支捕获，能正常捕获**

|Exception Name|Description|测试涉及的函数|
|:---|:---|:---|
|YAS-00330 invalid path|File location is invalid.|fopen-不存在的路径，路径拼写错误，路径为空‘’、null    
  fcopy-不存在的路径（源文件路径，目标文件路径），源、目标路径为空’‘/null，    
    
  frename-源路径以及目标路径为空‘’、null或不存在    
  fremove-路径为空’‘或null，路径不存在，路径拼写错误,  
|
|  `YAS-00327 INVALID_MODE`  |The       `open_mode`       parameter in       `FOPEN`       is invalid.|fopen-除a w r ab wb rb方式外其他打开模式（中文、英文、数字），,打开模式省略或为空或为空格,不填文件名（只有三个参数），,不填路径（只有三个参数）|
|  `YAS-00326 INVALID_FILEtype`  |File handle is invalid.|is_open-当前filehandle不在维护的filkeHandle list中，closeall后执行is_open    
  fclose-参数为空’‘/null，为空格,fclose_all-对FCLOSE_ALL之前打开的文件执行进一步的写入操作或读取操作,fseek-关闭的句柄    
  getline-文件处于关闭状态,省略handle参数,fflush-文件处于关闭状态，该参数为空''/null，为空格    
  putline-省略句柄，句柄为空，为空格，已关闭的文件句柄    
  put-句柄为空’‘、null，空格，已关闭的文件句柄    
  newline-省略句柄，句柄为空’‘、null，句柄为空格，已关闭的句柄|
|  `YAS-00301 INVALID_OPERATION`  |File could not be opened or operated on as requested.|fopen-以r或者rb打开时候，无效的文件路径，不存在的文件或路径    
  fcopy-    
  fremove-    
  fseek-打开模式为w或a，进行seek读数据    
  getline-打开模式为w、a    
  fflush-    
  putline-打开模式为r    
  put-打开模式为r    
  newline-|
|  `YAS-00328 READ_ERROR`  |Destination buffer too small, or operating system error occurred during the read operation|getline-len参数为负数|
|  `YAS-00325 WRITE_ERROR`  |Operating system error occurred during the write operation.|fclose-还有缓冲数据没写入（试下一个session，两个session）   --没出现    
  closeall-还有缓冲数据没写入（试下一个session，两个session） --没出现    
  fcopy-    
  fflush-    
  putline-待写入内容大于等于max_linesize    
  put-待写入内容大于等于max_linesize，循环写入不加new_line，拼接超过fopen设置的max_linesize    
  newline-待写入内容大于max_linesize|
|  `INTERNAL_ERROR`  |Unspecified PL/SQL error|  
|
|  `CHARSETMISMATCH`  |A file is opened using       `FOPEN_NCHAR`    , but later I/O operations use nonchar functions such as       `PUTF`       or       `GET_LINE.`  |  
|
|  `YAS-00336 FILE_OPEN`  |The requested operation failed because the file is open.|  
|
|  `YAS-00333 INVALID_MAXLINESIZE`  |The       `MAX_LINESIZE`       value for       `FOPEN()`       is invalid; it should be within the range 1 to 32767.|fopen-max_linesize参数设置=0，大于32000，为负数    
  getline-|
|  `YAS-00331 INVALID_FILENAME`  |The filename parameter is invalid.|fopen-文件名为空,fcopy-源文件、目标文件名为空’‘/null,frename-源文件或目标文件名为空,fremove-文件名为空’‘，null，    
    
|
|  `YAS-00313 ACCESS_DENIED`  |Permission to access to the file location is denied.|fopen-,fcopy-    
  frename-    
  fremove-|
|  `YAS-00329 INVALID_OFFSET`  |Causes of the       `INVALID_OFFSET`       exception:,-   `ABSOLUTE_OFFSET`       =       `NULL`       and       `RELATIVE_OFFSET = NULL`    , or
-   `ABSOLUTE_OFFSET`       < 0, or
- Either offset caused a seek past the end of the file
|fcopy-起始行大于max（终止行大于起始行、终止行小于起始行、终止行为0、终止行为负，终止行为null、终止行等于max），目标文件与源文件同路径同名不复制全部内容,fseek-绝对偏移为负，,绝对偏移大于文件内容最大长度，,绝对偏移和相对偏移均为负，,绝对偏移为null相对偏移大于文件内容最大长度,文件为空设置seek读取,new_line-  lines参数为空’‘/null，|
|  `YAS-00314 DELETE_FAILED`  |The requested file delete operation failed.|fremove-一个session在写，另一个session在remove|
|  `YAS-00315 RENAME_FAILED`  |The requested file rename operation failed.|frename-一个session在rename，另一个session在remove？场景还需构造|
|YAS-00337 only support directory begin with / or .|  
|fopen-~/路径，路径为空格,frename-源路径或目标路径为空格,fremove-路径为空格,fcopy-源、目标路径为空格,  
|
|其他error|  
|  
,  
|
|YAS-00336 too many open files , exceed 50|  
|fopen-重复打开文件超过50次，打开超过50个文件|
|YAS-00215 length of concat texts exceeds the buffer limit|  
|fopen-文件名长度超过255|
|YAS-00003 invalid parameter|  
|fgetattr-fexists数据类型错误，file_length ,block_size类型错误,frename函数中overwrite参数为其他字符,get_line省略buffer参数、buffer为空‘’/null，buffer为空格‘ ’，,putline-autoflush为其他类型，autoflush参数加引号，buffer类型为bool,put-buffer类型为bool,new_line-lines参数为负数|
|YAS-00008 type convert error|  
|get_line中buffer参数与文件内容不符，len为其他字符,fseek-absolute_offset为空格' '，absolute_offset为null，relative_offset为空格' ',new_line-lines为空格，为其他字符|
|YAS-00211 no data found|  
|getline读取的文件为空，不加seek循环读，读取的长度超过最大值,  
|
|YAS-04204 number of String length must be between 1 and 32000|  
|put-buffer超过数据类型限制长度,putline-buffer超过数据类型限制长度,  
|


### 并发测试：

|函数名|并发测试点（  与oracle比对||
|:---|:---|---|
|  
|session1:|session2:|
|F_COPY|  F_COPY|往文件（源文件、目标文件）一直写入数据put_line/put、new_line,一直在文件（源文件、目标文件）读数据get_line/fseek、get_line,删除文件fremove（源文件、目标文件）,重命名文件frename（源文件、目标文件）|
|F_GETATTR|F_GETATTR|往文件一直写入数据put_line/put、new_line,一直从文件读数据get_line/fseek、get_line,删除文件fremove,重命名文件frename|
|F_RENAME| frename,,  
|往文件一直写入数据put_line/put、new_line,一直从文件读数据get_line/fseek、get_line,删除文件fremove|
|F_REMOVE|F_REMOVE（  打印这个handle在另一个session打开操作）,  
|往文件一直写入数据put_line/put、new_line,一直从文件读数据get_line/fseek、get_line,重命名文件frename|
|F_CLOSEALL|F_CLOSEALl|往文件一直写入数据put_line/put、new_line,一直从文件读数据get_line/fseek、get_line,删除文件fremove,重命名文件frename|
|GET_LINE|GET_LINE读数据,  
|对同一个文件一直写数据put_line/put、new_line  （w，a模式打开）看速度,删除文件fremove,  
|
|  
|- 设置一个handle读取一个文件，并将读取的数据写到另一个文件
- 设置不同的handle读取不同的文件，并将读取的数据写到另一个文件
|- 设置一个handle读取一个文件，并将读取的数据写到另一个文件
- 设置不同的handle读取不同的文件，并将读取的数据写到另一个文件
|


# **重点：**

**file_type**

**exception异常句柄，用plsql  exception分支捕获，能正常捕获**

重点关注功能正确性

**可靠性：在读写操作的时候重启数据库，kill数据库，**

# **4. 详细设计**

见第3章节

#   
  5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-5-15_11-1-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OGJhMWFkOWEzMzExZGM3NzZhIiwicmVmX2lkIjoiNjczOTY5OGE1OTNmOTljOWZmMjM0ZmI5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MDQxLCJleHAiOjE3ODIyOTM0NDF9.mDH6xfh639YAOgO8Ex02thhcmBzHaPBov_IXZElIaHU)

 (image/png)    
