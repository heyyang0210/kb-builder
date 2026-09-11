Created by 谢昭贤 on 十月 13, 2024

# YDBRD-19180 【exp】支持指定字符集导出 

# YDBRD-19179 【imp】支持指定字符集导入

  


  


-   [YDBRD-19180 【exp】支持指定字符集导出 ](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-YDBRD-19180【exp】支持指定字符集导出)  
-   [YDBRD-19179 【imp】支持指定字符集导入](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-YDBRD-19179【imp】支持指定字符集导入)  
-   [](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-)  
-   [1. 概述](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-1.概述)  
    -   [1.1 相关文档](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-1.1相关文档)  
    -   [1.2 特性说明](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-1.2特性说明)  
-   [2. 需求分析](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-2.需求分析)  
    -   [2.1 功能点分析](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-2.1功能点分析)  
    -   [2.2 应用场景](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-2.2应用场景)  
    -   [2.3 规格约束](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-2.3规格约束)  
-   [3. 详细测试设计](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-3.详细测试设计)  
    -   [3.1 测试设计方法](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-3.1测试设计方法)  
        -   [3.1.1 字符集影响位置细分](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-3.1.1字符集影响位置细分)  
        -   [3.1.2 字符集影响位置总结](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-3.1.2字符集影响位置总结)  
        -   [ASCII](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-ASCII)  
        -   [ISO 8859-1](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-ISO8859-1)  
        -   [GBK](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-GBK)  
        -   [UTF-8](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-UTF-8)  
        -   [GB18030](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-GB18030)  
    -   [3.2 详细测试设计](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-3.2详细测试设计)  
        -   [3.2.1 DFX测试](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-3.2.1DFX测试)  
        -   [3.2.2 等价类](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-3.2.2等价类)  
-   [4. 测试用例](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-4.测试用例)  
    -   [4.1 冒烟用例](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-4.1冒烟用例)  
    -   [4.2 文本用例](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-4.2文本用例)  
-   [5. 测试框架设计](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-5.测试框架设计)  
-   [6. 测试环境说明](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-6.测试环境说明)  
-   [7. 工作量评估](#YDBRD19180【exp】支持指定字符集导出/YDBRD19179【imp】支持指定字符集导入-7.工作量评估)  


# 1. 概述

## 1.1 相关文档

SR: 

  [https://pingcode.yasdb.com/pjm/items/661156a7579a3edb84d68d5d](https://pingcode.yasdb.com/pjm/items/661156a7579a3edb84d68d5d)    ?    
  #YDBRD-19180 【exp】支持指定字符集导出

  [https://pingcode.yasdb.com/pjm/items/661156a4579a3edb84d68d51](https://pingcode.yasdb.com/pjm/items/661156a4579a3edb84d68d51)    ?    
  #YDBRD-19179 【imp】支持指定字符集导入

开发设计文档：    [exp imp 支持设置字符集](156136056.html)  

个人调研文档：    [3.1.0【个人调研】YDBRD-19180](https://conf.yasdb.com/pages/viewpage.action?pageId=159418098)  

调研文档：    [YDBRD-20530 测试调研(oracle)](https://conf.yasdb.com/pages/viewpage.action?pageId=135617176)  

概要设计文档：    [YDBRD-20530 测试概要设计](135617179.html)  

## 1.2 特性说明

exp 支持导出指定字符集

imp 适配字符集

# 2. 需求分析

## 2.1 功能点分析

|语法|作用|  
|
|:---|:---|---|
|exp       ,exp user/password file=./out   character_set=gbk ？ |导出为二进制,~~指定参数后保存字符集信息 ？   ~~    or       **报错，**  自动保存字符集信息|适配命令行输入中文用户名，表名导出，包括错误信息，进度展示为客户端字符集|
|exp --sql,exp --sql  user/password file=./out   character_set=gbk|导出为sql文件|--sql 与 --csv 对应的指定字符集的参数格式不同，是历史设计问题，两者走的是不同的参数读取|
|exp --csv,exp --csv -u user -p password -T table   --character-set gbk,exp --csv -u user -p password -T table --ch gbk|导出为csv文件|新增参数   **--character-set**    简写 --ch|
|imp|  
|适配命令行输入中文用户名，表名导出，包括错误信息，进度展示为客户端字符集|


  


## 2.2 应用场景

1）客户在不同字符集间使用exp/exp --sql/exp --csv时，保障  **数据正确，不乱码**

2）

## 2.3 规格约束

1）最终导出csv或sql的charset优先级 ：   **cmd 命令配置参数**     >       **exp.ini文件配置参数   **   >      **client/yasc_env.ini客户端文件配置参数**  。

2）不做从客户端字符集到终端字符集的显示转换。

3）

  


# 3. 详细测试设计

## 3.1 测试设计方法

1、考虑  exp/exp --sql/exp --csv/imp 工具，  **可能输入中文字符的命令行位置、**  **文件里**  **的配置**

2、考虑不同字符集的服务端、客户端之间的交互

3、考虑工具会输出的几类文件  .csv  .sql  .log  的   **文件名本身 以及  文件内容**

4、考虑工具会进行的  **打屏操作**

5、理清字符集处理顺序：

|  
|xshell show   —>    inux LANG||| —>|client_character |—>|input_file| —>|server_character | —>|output_file|—>|client_character|—>|linux LANG    —>    xshell show|||
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|  
|  
    
    
    
    
    
    
    
    
    
    
    
|||  
|  
|  
|  
|⬆|  
|⬆|  
|  
|  
|  
|  
    
    
    
    
    
,  
|||
|  
||||  
|  
|  
|  
|**set_character**|  
|**set_character**|  
|  
|  
|  
||||
|eg:  exp --sql||||  
|exp_KEYWORD|  
|/|character_set=GBK|UTF8|character_set=GBK|xx.sql文件|  
|print_log,write_logfile|  
||||


  


6、涉及字符集位置

最终导出csv或sql的charset优先级 ：   **cmd arg 命令配置参数**     >       **exp.ini文件配置参数   **   >      **client/yasc_env.ini客户端文件配置参数**  。

  


### 3.1.1   字符集影响位置细分

|  
|涉及文字输入的地方|  
|备注|
|---|---|---|---|
|1|exp --csv|  [doc exp--csv](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/exp/CSV%E6%96%87%E4%BB%B6%E5%AF%BC%E5%87%BA.html)  |  
|
|命令参数|含义|  
|以什么配置为准|
|*-f, --format*|  
|/|  
|
|*-u, --user*|登陆用户|涉及|**client/yasc_env.ini**|
|*-p, --password*|登陆密码|涉及||
|*[-L, --logfile]*|日志文件  **路径**,exp.log|涉及|终端输入字符集|
|*[-F, --file]*|CSV文件导出  **路径**|涉及||
|*[--lob]*|  
|/|  
|
|*[--inline-blob-format]*|  
|/|  
|
|*[--loglevel]*|  
|/|  
|
|*[--server-host]*|  
|/|  
|
|*[--use-threads]*|  
|/|  
|
|*[-q, --query]*|设置查询语句|涉及|**client/yasc_env.ini**|
|*[-qf, --query-file]*|指定查询语句  的SQL  **文件**  的  **路径、文件名**|涉及|终端输入字符集|
|*[-qo, --query-out-file]*|导出sql查询结果集文件名|涉及||
|*-T, --tables*|导出的表名|涉及|**client/yasc_env.ini**|
|*-O, --owner*|表的所属用户|涉及||
|*[--fields-enclosed-by]*|  
|/|  
|
|*[--fields-terminated-by]*|  
|/|  
|
|*[--lines-terminated-by]*|  
|/|  
|
|*[--date-format]*|修改日期格式|涉及|  
,**client/yasc_env.ini**    
    
    
|
|*[--time-format]*|修改时间格式|涉及||
|*[--timestamp-format]*|修改时间戳格式|涉及||
|命令参数|  
|  
|以什么配置为准|
|--config-file|使用配置  **文件名**|涉及|终端输入字符集|
|expconfig.ini |配置文件内容本身|涉及|**client/yasc_env.ini**|
|**⭐ 涉及文件**|  
|  
|以什么配置为准|
|导出的csv格式文件名,(用表名作文件名)|/|  
|  
|
|**⭐ **  **导出的csv格式文件本身内容**|  
|  
|cmd args > exp.ini > client/yasc_env.ini|
|日志文件名|/   (不可指定)|  
|  
|
|日志文件本身内容|  
|  
|**client/yasc_env.ini**|
|*-qo   *  导出sql查询结果集文件名|  
|  
|终端输入字符集|
|**⭐ **  **sql查询结果集文件本身内容**|  
|  
|cmd args > exp.ini > client/yasc_env.ini|
|***-qf  ***  **指定查询语句的SQL文件的内容**|  
|  
|**client/yasc_env.ini**|
|2|exp --sql,  
,exp ||  
|
|命令参数|  
|  
|以什么配置为准|
|FULL|export entire file (N)|/|  
|
|username|登陆用户|涉及|**client/yasc_env.ini**|
|password|登陆用户密码|涉及||
|FILE|output files,**包括路径名**|涉及|终端输入字符集|
|OWNER|list of owner usernames|涉及|**client/yasc_env.ini**|
|TABLES|list of table names|涉及||
|ROWS|export data rows (Y)|/|  
|
|LOG_PATH|指定日志文件  **路径**,不可指定默认为exp.log|  
|路径：|
|LOG_LEVEL|export log level (INFO)|/|  
|
|**⭐ 涉及文件**|  
|  
|以什么配置为准|
|导出的file文件名|  
|  
|终端输入字符集|
|**⭐**  **导出的file文件本身内容**|  
|  
|cmd args > exp.ini > client/yasc_env.ini|
|3|imp||  
|
|命令参数|  
|  
|以什么配置为准|
|FULL|import entire file (N)|/|  
|
|username|登陆用户|涉及|**client/yasc_env.ini**|
|password|登陆用户密码|涉及||
|FILE|input files,**包括路径名**|涉及|终端输入字符集|
|FROMUSER|list of owner usernames|涉及|**client/yasc_env.ini**|
|TABLES|list of table names|涉及|**client/yasc_env.ini**|
|IGNORE|ignore create errors (N)|/|  
|
|TOUSER|list of usernames|涉及|**client/yasc_env.ini**|
|ROWS|import data rows (Y)|/|  
|
|DATA_ONLY|import only data (N)|/|  
|
|LOG_PATH|import log directory    **路径名**|涉及|终端输入字符集|
|LOG_LEVEL|import log level (INFO)|/|  
|
|TRUNCATE|delete existing rows and then import (N)|/|  
|
|4|  
|  
|  
|


|命令参数|含义|  
|以什么配置为准|
|---|---|---|---|
|*-f, --format*|  
|/|  
|
|*-u, --user*|登陆用户|涉及|**client/yasc_env.ini**|
|*-p, --password*|登陆密码|涉及||
|*[-L, --logfile]*|日志文件  **路径**,exp.log|涉及|终端输入字符集|
|*[-F, --file]*|CSV文件导出  **路径**|涉及||
|*[--lob]*|  
|/|  
|
|*[--inline-blob-format]*|  
|/|  
|
|*[--loglevel]*|  
|/|  
|
|*[--server-host]*|  
|/|  
|
|*[--use-threads]*|  
|/|  
|
|*[-q, --query]*|设置查询语句|涉及|**client/yasc_env.ini**|
|*[-qf, --query-file]*|指定查询语句  的SQL  **文件**  的  **路径、文件名**|涉及|终端输入字符集|
|*[-qo, --query-out-file]*|导出sql查询结果集文件名|涉及||
|*-T, --tables*|导出的表名|涉及|**client/yasc_env.ini**|
|*-O, --owner*|表的所属用户|涉及||
|*[--fields-enclosed-by]*|  
|/|  
|
|*[--fields-terminated-by]*|  
|/|  
|
|*[--lines-terminated-by]*|  
|/|  
|
|*[--date-format]*|修改日期格式|涉及|  
,**client/yasc_env.ini**    
    
    
|
|*[--time-format]*|修改时间格式|涉及||
|*[--timestamp-format]*|修改时间戳格式|涉及||
|命令参数|  
|  
|以什么配置为准|
|--config-file|使用配置  **文件名**|涉及|终端输入字符集|
|expconfig.ini |配置文件内容本身|涉及|**client/yasc_env.ini**|
|**⭐ 涉及文件**|  
|  
|以什么配置为准|
|导出的csv格式文件名,(用表名作文件名)|/|  
|  
|
|**⭐ **  **导出的csv格式文件本身内容**|  
|  
|cmd args > exp.ini > client/yasc_env.ini|
|日志文件名|/   (不可指定)|  
|  
|
|日志文件本身内容|  
|  
|**client/yasc_env.ini**|
|*-qo   *  导出sql查询结果集文件名|  
|  
|终端输入字符集|
|**⭐ **  **sql查询结果集文件本身内容**|  
|  
|cmd args > exp.ini > client/yasc_env.ini|
|***-qf  ***  **指定查询语句的SQL文件的内容**|  
|  
|**client/yasc_env.ini**|


|命令参数|  
|  
|以什么配置为准|
|---|---|---|---|
|FULL|export entire file (N)|/|  
|
|username|登陆用户|涉及|**client/yasc_env.ini**|
|password|登陆用户密码|涉及||
|FILE|output files,**包括路径名**|涉及|终端输入字符集|
|OWNER|list of owner usernames|涉及|**client/yasc_env.ini**|
|TABLES|list of table names|涉及||
|ROWS|export data rows (Y)|/|  
|
|LOG_PATH|指定日志文件  **路径**,不可指定默认为exp.log|  
|路径：|
|LOG_LEVEL|export log level (INFO)|/|  
|
|**⭐ 涉及文件**|  
|  
|以什么配置为准|
|导出的file文件名|  
|  
|终端输入字符集|
|**⭐**  **导出的file文件本身内容**|  
|  
|cmd args > exp.ini > client/yasc_env.ini|


|命令参数|  
|  
|以什么配置为准|
|---|---|---|---|
|FULL|import entire file (N)|/|  
|
|username|登陆用户|涉及|**client/yasc_env.ini**|
|password|登陆用户密码|涉及||
|FILE|input files,**包括路径名**|涉及|终端输入字符集|
|FROMUSER|list of owner usernames|涉及|**client/yasc_env.ini**|
|TABLES|list of table names|涉及|**client/yasc_env.ini**|
|IGNORE|ignore create errors (N)|/|  
|
|TOUSER|list of usernames|涉及|**client/yasc_env.ini**|
|ROWS|import data rows (Y)|/|  
|
|DATA_ONLY|import only data (N)|/|  
|
|LOG_PATH|import log directory    **路径名**|涉及|终端输入字符集|
|LOG_LEVEL|import log level (INFO)|/|  
|
|TRUNCATE|delete existing rows and then import (N)|/|  
|


  


  


### 3.1.2 字符集影响位置总结

|  
|字符集|工具|影响位置|  
|
|---|---|---|---|---|
|1|终端输入字符集,（比如把命令放在gbk文件里，然后执行，这时候就是gbk编码的命令输入）|exp --csv|* [-L, --logfile]*|日志文件  **路径 ， **  默认日志为exp.log|
|  
|  
||*[-F, --file]*|CSV文件导出  **路径**|
|  
|  
||*[-qo, --query-out-file]*|导出sql查询结果集文件名， 涉及  **路径、导出文件名**|
|  
|  
||--config-file|使用配置  **文件名**|
|  
|  
||*[-qf, --query-file]*|指定查询语句  的SQL  **文件**  的  **路径、文件名**|
|  
|  
|exp --sql,exp/imp| FILE|output files     **包括路径名、导出文件名**|
|  
|  
||LOG_PATH|指定日志文件  **路径 ,  **  不可指定默认为exp.log|
|2|**client/yasc_env.ini**|exp --csv    
    
    
    
    
    
    
    
    
|*-u, --user*|登陆用户|
|  
|  
||*-p, --password*|登陆密码|
|  
|  
||*[-q, --query]*|设置查询语句|
|  
|  
||*[--date-format]*|修改日期格式|
|  
|  
||*[--time-format]*|修改时间格式|
|  
|  
||*[--timestamp-format]*|修改时间戳格式|
|  
|  
||expconfig.ini |配置文件  **内容本身**|
|  
|  
||  
|日志文件本身内容|
|  
|  
||***-qf  ***|指定查询语句  的  **SQL文件的**  **内容**|
|  
|  
|exp --sql,exp/imp|username|登陆用户|
|  
|  
||password|登陆用户密码|
|  
|  
||OWNER|list of owner usernames|
|  
|  
||TABLES|list of table names|
|  
|  
||username|登陆用户|
|  
|  
||password|登陆用户密码|
|  
|  
||FROMUSER|list of owner usernames|
|  
|  
||TABLES|list of table names|
|3|**cmd args**   > exp.ini > client/yasc_env.ini|exp --csv|  
|**⭐ **  **导出的csv格式文件本身内容**|
|  
|  
||  
|**⭐ **  **sql查询结果集文件本身内容**|
|  
|  
|exp --sql|  
|**⭐**  **导出的file文件本身内容**|
|  
|  
|  
|  
|  
|


  


  


  


7. 字符集交叉， 标蓝色的为重点，优先校验

|  
|英|文字、表情等||
|---|---|---|---|
|### ASCII|**1个字节**|||
|### ISO 8859-1|**1个字节**|||
|### GBK|**1个字节**|**1、2        个字节**||
|### **UTF-8**|**1个字节**|**2、3、4  个字节**||
|### GB18030|**1个字节**|**1、2、4  个字节**||


|C\S|ASCII|ISO88591|GBK|UTF8|GB18030|
|---|---|---|---|---|---|
|ASCII|**全解析**|  
|  
|  
|  
|
|ISO88591|  
|**全解析**|  
|  
|  
|
|GBK|  
|  
|**全解析**|  
|  
|
|UTF8|  
|  
|  
|**全解析**|  
|
|GB18030|  
|  
|  
|  
|**全解析**|


  


8.测试校验方法/测试形态

1）exp --csv 结合 yasldr

2）exp --sql 结合  yasql

3）exp          结合  imp

4）优先  **单机，**  验证分布式、集群

9.用例测试流程

1）yasql建立对象

2) 查询元数据信息、数据信息

3）exp/ exp --sql / exp --csv  指定字符集导出

4）清库

5）imp 默认导入 / yasql 客户端配置文件字符集 / yasldr 指定字符集导入

6）查询元数据信息、数据信息

7）前后对比校验

  


## 3.2 详细测试设计

### 3.2.1 DFX测试

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT并发|不涉及|  
|
|KT|不涉及|  
|
|长稳|不涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR故障|不涉及|  
|
|HA高可用|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|


### 3.2.2 等价类

|序|类别|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|1|功能校验|数据类型|c1 tinyint,,c2 smallint,,c3 int, c4 int(255), c5 integer, c6 pls_integer,,c7 bigint,,c8 float, c9 binary_float, c10 real,,c11 double, c12 binary_double,,c13 number, c14 decimal, c15 numeric, c16 number(38,23),,c17 boolean,,c18 date,,c19 time,,c20 timestamp,,c21 interval year to month,,c22 interval day to second,,c23 blob, ,c25 raw(10),h10 bit(64),,h12 rowid,,h13 urowid,,~~h14 st_geometry,  udt没有~~|类型应与字符集无关|  
|  
|
|2|功能校验|数据类型|c24 clob, ,**c26 json,  二进制还没适配**,h2 char(8000), h3 character(8000),,h4 varchar(32000), h5 varchar2(32000), h6 character varying(32000),,h1 char(30 char),,h7 nchar(4000),,h8 nvarchar(16000), h9 nvarchar2(16000),,h11 nclob,  ,h15 xmltype|类型应与字符集相关|  
|  
|
|3|功能校验|数据取值|ASCII ,ISO,GBK:  1/2 字节,UTF8：  1/2/3/4 字节,GB18030:  1/2/4 字节     ,数据大小边界,数据长度边界,null、空串|  
|  
|  
|
|4|功能校验|字符集字节数|（由长变短、由短变长）|  
|  
|  
|
|5|功能校验|导出模式|全库、表模式、用户模式|  
|  
|  
|
|6|功能校验|测试组网|单机、分布式、集群|  
|  
|  
|
|7|功能校验|yasldr|1、日期格式,2、分区类型,3、分区条件带中文|  
|  
|  
|
|8|  
|分布式列表|分布式列表，json： utf8、gb18030|  
|  
|  
|
|9|功能校验|数据设计|文字数据（注意含lob）,文字对象名,列名|  
|  
|  
|
|10|功能校验|文件设计|文字路径,文字文件名,文字query文件|  
|  
|  
|
|11|  
|**根据 **  3.1.2 字符集影响位置总结 ,对各项内容进行校验|注意校验文件,**⭐ **  **导出的csv格式文件本身内容**,**⭐ **  **sql查询结果集文件本身内容**,**⭐**  **导出的file文件本身内容**|  
|  
|  
|
|12|功能校验|exp --csv|lob 、csv,**lls模式下，导出的**  **偏移量不同 （数据字节不同、lob长度设计不相同）**,**clob、nclob**|  [lls-column-clause](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/LOAD%20DATA.html#lls-column-clause)  |  
|  
|
|13|场景校验|exp/exp --csv/exp --sql并发|1、exp进程字符集相同,2、exp进程字符集不同|进程间处理不冲突|  
|  
|
|14|场景校验|**--csv 设置线程数参数**,***[--use-threads]***,**每个线程对应一个表**|1、（数据量1M、多线程）,2、不同字符集转换|  
|  
|  
|
|15|场景校验|输入编码|sql、py脚本文件编码、,subprocess.run的encoding：,**GBK、UTF8、GB18030**|  
|  
|  
|
|16|场景校验|系统环境|win、linux_x86、linux_arm|  
|  
|  
|
|17|参数校验|  
|参数、参数值大小写,参数、参数值 单双引号包围|  
|1、非  UTF8、GBK、GB18030、ISO88591、ASCII字符,2、空串,3、相似字符,4、超长|  
|


  


# 4. 测试用例

## 4.1 冒烟用例

```
1.
```

  


## 4.2 文本用例

文本用例：

  [X_文本用例模板.xlsx](#)  

属性表：

# 5. 测试框架设计

1） 自动化用例：

使用导入导出框架进行测试    [https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test)  

**放置于不同字符集的目录，跑对应的工程**

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

1）辅助工具：部署、执行、字符集配置脚本：    [https://git.yasdb.com/xiezhaoxian/scripts](https://git.yasdb.com/xiezhaoxian/scripts)  

2）测试环境：

|  
|CPU|操作系统|可用内存|可用磁盘空间|磁盘类型|
|:---|:---|:---|:---|:---|:---|
|192.168.7.104|Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz|Linux AchorBase 3.10.0-1160.114.2.el7.x86_64|50G|303G|HDD|


# 7. 工作量评估

工作量：14 天

计划测试完成时间：

  
