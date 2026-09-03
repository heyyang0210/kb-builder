Created by 张丽红, last modified on 八月 13, 2022

# 0、背景

YashanDB需要支持CDC功能，往其他类型数据库（oracle，MySQL等）实时同步数据。基本原理是，从redo里解析出  **逻辑日志**  ，组装成SQL，在其他数据库上执行，实现数据同步。

为了实现这个功能，这个需求从单机到解决方案，拆分成3部分：

（1）现有的redo信息不足以解析出可用的逻辑日志，需要往日志里增加附加日志

         功能：支持附加日志的写入

（2）从redo里解析出逻辑日志，  为此需要提供解析日志的API接口，用来从redo解析出逻辑日志

        功能： 提供解析接口，可正确解析出数据

（3）将逻辑日志组装成SQL并且往其它类型数据库实时同步数据----解决方案-陈阳

结论：当前我们验基本场景，确保解析出来的数据正确，以及事务顺序正确；并行场景解决方案工具做完之后解决方案和我们都需要验证

# 1、概述

本文描述 逻辑解析API 的测试设计

# 2、需求分析

**开启附加日志语法：**

- 开启表级附加日志：  **ALTER TABLE**  ** **  ***table_name***  ** **  **ADD SUPPLEMENTAL LOG DATA (PRIMARY KEY, UNIQUE, ALL) COLUMNS**
- 关闭表级附加日志：  **ALTER TABLE**  ** **  ***table_name***  ** **  **DROP SUPPLEMENTAL LOG DATA**


**参数：**

- PRIMARY KEY：update,delete日志中记录  **主键列**  ，适用于带主键的表
- UNIQUE：         update,delete日志中记录  **唯一索引列**  ，适用于带唯一索引列的表，并且这个列是非空的
- ALL：                update,delete日志中记录  **所有列（除LOB）**  ，适用于没有索引的表，但这种where条件不保证唯一性。且日志膨胀严重，需谨慎使用


**逻辑解析API涉及库：**    [libyas_logminer.so](http://libyas_logminer.so)  

**逻辑解析API涉及接口：**

-  void (LogCallback*)（level，fmt，。。。） 
- CodResult     **lgmInit**  (MinerHandler* handler, LogCallback* func)   //初始化LgmManager指针
- void     **lgmDestory**  (MinerHandler* handler)   //释放LgmManager指针
- CodResult     **lgmBufExtent**  (MinerHandler* handler，CodUint64 bufSize) // 用来扩展解析buffer，默认内存是128M：64M读文件buffer，64M解析缓存
- void     **lgmSetRedoFiles**  (MinerHandler* handler, CodChar** redoPath, CodUint32 redoCount) //  设置redo文件的绝对路径
- void     **lgmSetArchPath**  (MinerHandler* handler, CodChar* archPath)   //  设置归档目录的绝对路径
- void     **lgmSetPoint**  (MinerHandler* handler, RdPoint point, CodUint64 scn) // 设置日志解析开始点
- void     **lgmGetPoint**  (MinerHandler* handler, RdPoint* point, CodUint64* scn) // 获取当前日志解析点
- void     **lgmParseLob**  (MinerHandler* handler, CodChar* data, CodUint32 size, LogMinerLobCoupon* coupon); // lob列的值是LobCoupon结构体，需要单独解析
- CodResult     **lgmFetch**  (MinerHandler* handler, CodUint32* type, LogMinerResult* result, CodUint32* errorCode) 每调用一次，返回一个DDL日志或者DML日志的解析结果


**注意事项：**

- 设置开始点之前，确保要解析的表，已经开启了附加日志。
- 通过查询V$LOGFILE获取所有redo文件的路径，查询参数得到归档路径
- 开始点可以通过V$DATABASE视图得到当前日志点和当前SCN，解析API只解析后续新产生的redo。
- 因为redo日志不会记录每个列的数据类型，只能得到数据字节和长度，要解析到完整的DML sql语句，需要调用者根据列类型去转换
- 测试过程中要注意事务id和事务顺序


**约束限制：**

- 不支持临时表


# 3、测试设计方法

### 3.1、针对API所有接口中涉及的参数进行验证

接口验证部分：待确认是否进行验证？如果接口要暴露给客户的话，需要进行验证

该API其实就是一堆接口的封装，需要对涉及到的所有接口进行基本的参数校验，此处主要采用等价类划分法和错误推测法进行验证。

|参数名称|参数说明|参数的有效输入值|参数的无效输入值|
|---|---|---|---|
|lgmPointer|需要初始化的LgmManager指针，初始化过程将申请必要的内存，并将该指针指向该内存|正常申请|1、环境内存不足时进行申请（申请失败）|
|logPath|run log目录|正确的runlog目录|1、runlog目录不存在,2、数据库对runlog目录无访问权限,3、入参值为空,4、入参值为null|
|logLevel|run log的级别|正确的runlog级别（info，debug，error，all）|1、不存在的level,2、入参值为null|
|redoPath|redo文件的绝对路径数组|正确的绝对路径|1、不存在的绝对路径,2、错误的绝对路径,3、只写了一个redo路径，但实际上有多个redo路径,3、绝对路径下的redo文件被删除,3、入参值为空,4、入参值为null|
|redoCount|redo文件的个数|正确的redo文件个数|1、值为0,2、redo文件个数和redopath中的数量不匹配（大于、小于）,3、入参值为空,4、入参值为null|
|archPath|归档目录的绝对路径|正确的归档路径|1、不存在的绝对路径,2、错误的绝对路径,3、绝对路径下的归档文件被删除,3、入参值为空,4、入参值为null|
|point|开始解析的redo日志点（lgmGetPoint中是指：当前的redo日志点）|1、当前point,2、最小的point,3、介于最小和中间的point|1、不存在的值,2、值为空,3、值为null|
|scn|开始解析的scn（lgmGetPoint中是指：当前的scn）|1、当前scn,2、可闪回查询到数据的scn（对于闪回，需要手动批量导入数据）|1、不存在的值,2、值为空,3、值为null|
|bufSize|本次扩展的内存大小|小于环境内存的可用内存|1、大小环境本身的内存,2、小于可申请的内存最小值  （可申请的内存值有没有下限？）,2、值为空,3、值为null|
|data|列数据数组|/|/|
|col|LOB列在数组中的位置|/|/|
|size|LOB列数据长度|/|/|
|minerCoupon|LOB列的解析结果|/|/|
|type|逻辑日志类型|/|/|
|result|逻辑日志结果集|/|/|
|errorCode|失败类型|/|/|


### 3.2 对于需要解析的操作进行验证

该API是用来进行解析redo日志，进而得到逻辑日志。所以需要覆盖需要解析的各种类型的操作。按照附加日志的新增内容以及redo日志中已有的内容，将各种操作进行划分并分别进行覆盖。主要采用的是等价类划分法和场景法（  **测试过程中要注意事务id和事务顺序**  ）

|操作类型|操作细化|有效等价类|备注|
|---|---|---|---|
|ddl|index相关操作|1、create index,2、drop index（这种操作是否会记录？）---记录,3、alter index属性（这种操作是否会记录？）---记录|  
|
|  
|column相关操作|1、add column,2、drop column,3、modify column,4、rename column|  
|
|  
|constraint相关操作|1、add constraint,2、drop constraint|  
|
|  
|truncate操作|1、truncate|  
|
|  
|drop操作|1、drop table|  
|
|  
|分区操作|1、drop 分区,2、add分区,3、truncate分区|分区表相关的操作在普通表中未覆盖（已覆盖）|
|  
|table操作|1、rename table,2、rowmovement 开关,3、alter slice stable开关,4、range-interval分区转换操作,5、触发器|1、分区相关在分区表场景中测试（已覆盖）,2、列存相关在列存中测试（已覆盖）,3、触发器在char类型和int类型中覆盖（已覆盖）|
|dml|insert|1、正常insert–不带filter,1、正常insert--带filter,1、行链接和行迁移的场景,2、insert into 多行,3、insert into tb values() on duplicated key update ,4、insert into tb values(select * from tb2),5、insert into select,6、insert all,6、  列存表批量导入数据（以batch为单位：4000+ row【vgd方式和rgd,方式--空】）,7、heap的批量插入（千级）,7、insert 数据到指定分区|lob相关操作，insert时需要注意，覆盖两种场景：,1、<= 4000字节的数据,2、> 4000字节的数据,  
,  
,1、批量插入作为特殊场景单独测试（已测试）,2、分区场景在分区表中进行测试（已测试）|
|  
|update|1、正常update–不带filter,2、正常update–带filter,3、行链接和行迁移的场景,4、主键更新,5、select for update,6、update指定分区的数据,7、跨分区更新|数据分区相关的在分区表场景中验证（已覆盖）|
|  
|delete|1、正常delete–不带filter,2、正常delete–带filter,3、delete指定分区的数据|数据分区相关的在分区表场景中验证（已覆盖）|
|  
|merge into|1、正常merge into|  
|
|  
|select|1、正常select—不带filter,2、正常select—带filter,3、cte,4、select指定分区的数据|数据分区相关的在分区表场景中验证|
|  
|多表dml|1、多表insert,2、多表update,3、多表delete|  
|
|  
|过程体|1、存储过程,2、自定义函数|  
|
|事务相关操作|commit|1、单行数据正常commit,2、1批数据正常commit|  
|
|  
|rollback|1、单行数据正常rollback,2、1批数据正常rollback,3、  kill session，正常回滚|  
|
|  
|savepoint|1、update的过程中某一条失败导致自动rollback to savepoint,2、手动显示执行rollback to savepoint|  
|
|  
|自治事务|过程体中的自治事务|  
|
|lob相关操作|  
|lob相关的操作在每一种场景中都需要覆盖|  
|


### 3.3 从接口的角度出发，针对每个接口的测试

因为在覆盖各种操作的时候，已经基本覆盖测试了8个接口，剩余2个接口未覆盖到，需要单独测试（  lgmGetPoint，lgmGetBufferSize  ）

lgmGetPoint：指定scn和pint获取当前解析的redo位置（测试手段：没有新增日志时，查询point是否和当前的flushpoint点一致）

lgmGetBufferSize：内存扩展之后，通过该接口查询当前内存的大小（需要重点测试）

场景1：持续长时间做日志解析，解析完成后，未调用  **lgmDestory**  释放资源，然后继续下发大数据占用内存的业务（因为内存不足导致业务下发失败，调用  **lgmDestory**  释放资源后，再次下发业务，业务下发成功）

场景2：持续长时间做日志解析，解析完成并释放资源后，继续下发大数据占用内存的业务，检查有无内存泄漏的情况

### 3.3 异常场景

在使用API进行日志解析的过程中可能会有一些异常情况，采用错误推测法并结合实际使用过程中可能遇到的一些错误场景做测试。验证的主要场景如下：

|覆盖各种错误类型：|
|---|
|errorCode|说明|
|MINER_ERROR_BUF_SIZE|解析时内存不足，可能是大并发事务或者遇到批量insert，数据量较大，可以调用lgmExtendBuffer来扩展内存，然后重新lgmFetch，建议每次扩展至少1M内存（批量插入，行长一点；列存行长31M，2row）|
|MINER_ERROR_FILE_READ|文件读取失败，可能是redo或归档路径不对，也可能是权限获其他问题，可从run log里找到具体原因。如果是路径错误，重新设置路径|
|MINER_ERROR_INVALID_FILE|redo或归档文件的checksum不正确，可能是文件已损坏|
|MINER_ERROR_NO_MORE_LOG|redo日志已经解析到最后，没有更多的日志了，可能数据库此时没有业务。此时可以查询数据库视图，看FLUSH_POINT是否不变，等FLUSH_POINT更新后再继续解析|
|MINER_ERROR_REDO_NOT_FOUND|- 可能是新增了redo文件，但是解析接口没有同步，需要重新设置redo路径（关闭归档后新增redo）
- 可能是归档备机清理了，需要增大归档预留空间，或者关闭自动清理改为手动清理
|
|数据库重启，事务中断，扫归档|  
|


|errorCode|说明|
|---|---|
|MINER_ERROR_BUF_SIZE|解析时内存不足，可能是大并发事务或者遇到批量insert，数据量较大，可以调用lgmExtendBuffer来扩展内存，然后重新lgmFetch，建议每次扩展至少1M内存（批量插入，行长一点；列存行长31M，2row）|
|MINER_ERROR_FILE_READ|文件读取失败，可能是redo或归档路径不对，也可能是权限获其他问题，可从run log里找到具体原因。如果是路径错误，重新设置路径|
|MINER_ERROR_INVALID_FILE|redo或归档文件的checksum不正确，可能是文件已损坏|
|MINER_ERROR_NO_MORE_LOG|redo日志已经解析到最后，没有更多的日志了，可能数据库此时没有业务。此时可以查询数据库视图，看FLUSH_POINT是否不变，等FLUSH_POINT更新后再继续解析|
|MINER_ERROR_REDO_NOT_FOUND|- 可能是新增了redo文件，但是解析接口没有同步，需要重新设置redo路径（关闭归档后新增redo）
- 可能是归档备机清理了，需要增大归档预留空间，或者关闭自动清理改为手动清理
|
|数据库重启，事务中断，扫归档|  
|


  
  3.4 并发场景（包括并发和kill两种场景）

备注：并发场景在亚娜的测试中，检查是否有core；数据正确性需要解决方案工具测试那边保证

因为在实际的业务使用场景中并发是必然的，所以在日志解析时同样需要处理并发场景。具体场景如下：

|编号|场景|预期|备注|
|---|---|---|---|
|1|多线程并发执行ddl操作，然后进行解析|日志解析成功|在这些操作中都需要考虑到lob类型|
|2|多线程并发执行dml操作，然后进行解析|日志解析成功|  
|
|3|多线程并发执行ddl和dml操作，然后进行解析|日志解析成功|  
|
|4|dml操作和事务相关操作并发的时候进行日志解析|日志解析成功|  
|
|5|并发解析2张表的ddl操作|解析成功|  
|
|6|并发解析2张表的dml操作|解析成功|  
|
|7|并发解析2张表的ddl操作和dml操作|解析成功|  
|
|  
|  
|  
|  
|


### 3.5 HA备机场景

HA场景的备机也可以做日志解析，在备机覆盖基本的场景即可。

  


### 3.last 需要的不同维度的场景

|维度|场景细化|编号|备注|
|---|---|---|---|
|数据类型|数值类型|1|  
|
|  
|字符类型|2|  
|
|  
|时间日期类型|3|  
|
|  
|LOB类型|4|  
|
|  
|布尔类型|5|  
|
|  
|二进制类型|6|  
|
|是否带索引|带索引|7|  
|
|  
|不带索引|8|  
|
|索引类型|主键|9|  
|
|  
|外键|10|  
|
|  
|唯一索引/local唯一索引|11|  
|
|  
|普通索引|12|  
|
|  
|unique约束|14|  
|
|  
|无索引|15|  
|
|索引对应的列数|单列索引|16|  
|
|  
|复合索引|17|  
|
|同一张表上包含的索引的个数|单个索引|18|  
|
|  
|多个索引|19|  
|
|**表类型**|**普通表**|  
|**不支持临时表**|
|  
|**分区表**|  
|  
|
|**行列类型**|**行表**|  
|  
|
|  
|**TAC表**|  
|  
|
|  
|**LSC表**|  
|  
|
|  
|**EPC表**|  
|  
|


  


不同维度的输入条件组合后涉及到的表如下：

|编号|表数据类型|索引|索引类型|索引数量|备注1|
|---|---|---|---|---|---|
|tb1|二进制类型|无索引|  
|  
|二进制类型现在只能插null|
|1|布尔类型|普通索引|复合索引|多个索引|  
|
|tb3|二进制类型|主键|复合索引|多个索引|不涉及|
|tb4|二进制类型|外键|复合索引|单个索引|不涉及|
|2|字符类型|普通索引|单列索引|单个索引|  
|
|tb6|时间日期类型|unique约束|单列索引|多个索引|时间日期类型框架中尚未实现|
|3|数值类型|unique约束|复合索引|单个索引|number/float/double类型框架中尚未实现|
|4|LOB类型|无索引|  
|  
|特殊场景，需要插入超长数据，后面一起测,（在批量插入数据场景中覆盖）|
|5|字符类型|无索引|  
|  
|  
|
|6|数值类型|无索引|  
|  
|  
|
|7|布尔类型|主键|单列索引|单个索引|  
|
|8|数值类型|主键|复合索引|多个索引|  
|
|9|布尔类型|唯一索引/local唯一索引|复合索引|多个索引|  
|
|10|字符类型|唯一索引/local唯一索引|单列索引|多个索引|  
|
|11|布尔类型|无索引|  
|  
|  
|
|tb16|二进制类型|唯一索引/local唯一索引|复合索引|多个索引|值只能为null，不涉及|
|12|布尔类型|外键|复合索引|单个索引|  
|
|tb18|时间日期类型|唯一索引/local唯一索引|复合索引|单个索引|  
|
|tb19|二进制类型|unique约束|单列索引|单个索引|值只能为null，不涉及|
|tb20|时间日期类型|外键|复合索引|多个索引|  
|
|tb21|时间日期类型|普通索引|单列索引|多个索引|  
|
|tb22|二进制类型|普通索引|单列索引|多个索引|raw类型不支持建索引|
|13|数值类型|外键|单列索引|多个索引|  
|
|14|布尔类型|unique约束|复合索引|单个索引|  
|
|15|数值类型|普通索引|单列索引|单个索引|  
|
|16|字符类型|unique约束|单列索引|单个索引|  
|
|tb27|时间日期类型|无索引|  
|  
|  
|
|17|数值类型|唯一索引/local唯一索引|复合索引|多个索引|  
|
|18|字符类型|主键|单列索引|单个索引|  
|
|tb30|时间日期类型|主键|单列索引|多个索引|  
|
|19|字符类型|外键|单列索引|单个索引|  
|


  


# 4、测试重点和测试难点分析

4.1、需要覆盖较多场景，走完一条流程需要耗费较多时间

4.2、测试框架-数值类型相关-尚未完善，需要完善和优化测试框架

4.3、测试完成后涉及到的kill等异常场景没有办法自动化，无法维护，有风险

# 5、重点验证场景

|编号|场景描述|
|---|---|
|行链接基本场景|  
|
|  
|1、insert插入时行数据不足以在一个页面上存储，直接以行链接的方式存储，涉及2个分片|
|  
|2、insert插入时行数据不足以在一个页面上存储，直接以行链接的方式存储，涉及10个分片|
|  
|3、update后，数据长度大于1个页面的大小，产生行链接，涉及2个分片|
|  
|4、update后，数据长度大于1个页面的大小，产生行链接，涉及10个分片|
|行迁移基本场景|  
|
|  
|1、普通行update后，当前页面上不足以存放该行，这个时候产生行迁移（单个行迁移）|
|  
|2、普通行update后，当前页面上不足以存放该行，这个时候产生行迁移（多个行迁移）|
|衍生场景|  
|
|  
|1、分片迁移（行迁移的分片通过update产生产生迁移）|
|  
|2、分片分裂（行迁移的分片通过update产生行链接）|
|  
|3、分片迁移（行链接的分片通过update产生行迁移，中间某个分片变化）|
|  
|4、分片迁移（行链接的分片通过update产生行迁移，第1个分片变化）|
|  
|5、分片分裂（行链接的分片通过update产生行链接，中间某个分片变化）|
|  
|6、分片迁移（行链接的分片通过update产生行链接，第1个分片变化）|
|  
|7、分片迁移（行链接的分片通过update产生行链接，多个分区同时发生变化）|
|  
|8、分片合并（行迁移的分片合并）(分片数大于等于240分片合并重组)|
|  
|9、分片合并（行链接的分片合并）(分片数大于等于240分片合并重组)|
|针对列表存储的场景|  
|
|  
|1、变长列：32字节前后一直批量更新变化|
|  
|2、变长列：更新时，同时变长和变短|
|  
|3、批量插入时：变长列，定长列，批量插入|


# 6、导入工具的重点验证场景

【heap场景】（sql模式和batch模式）

|用例编号|数据类型|表类型|索引类型|附加日志类型|
|---|---|---|---|---|
|1|lob类型，结合其它数据类型|普通表|无索引|开启all类型附加日志|
|2|lob类型，结合其它数据类型|分区表|无索引|开启all类型附加日志|
|3|布尔类型+二进制类型|普通表|普通索引+不带索引|开启all类型附加日志|
|4|时间类型|普通表|普通索引+不带索引|开启all类型附加日志|
|5|数值类型|普通表|主键|开启pk类型附加日志|
|6|数值类型|分区表|唯一约束+not null|开启unique类型附加日志|
|7|时间类型|分区表|主键|开启pk类型附加日志|
|8|字符类型|分区表|主键|开启pk类型附加日志|
|9|数值类型|分区表|普通索引+不带索引|开启all类型附加日志|
|10|字符类型|普通表|普通索引+不带索引|开启all类型附加日志|
|11|字符类型|普通表|组合索引|开启pk类型附加日志|
|12|时间类型|分区表|组合索引|开启all类型附加日志|
|13|数值类型|普通表|组合索引|开启unique类型附加日志|
|14|字符类型|普通表|唯一约束+not null|开启unique类型附加日志|
|15|时间类型|普通表|唯一约束+not null|开启unique类型附加日志|
|16|字符类型|普通表|唯一索引|开启unique类型附加日志|
|17|时间类型|分区表|唯一索引|开启unique类型附加日志|
|18|数值类型|分区表|唯一索引|开启unique类型附加日志|
|特殊情况1|blob类型框架没法解析，需要在工具端进行测试|  
|  
|  
|


【tac场景】

在heap的场景上，去除lob和二进制类型

【lsc场景】

|用例编号|数据类型|表类型|索引类型|附加日志类型|
|---|---|---|---|---|
|1|Clob类型，结合其它数据类型|普通表|无索引|开启all类型附加日志|
|2|Clob类型，结合其它数据类型|分区表|无索引|开启all类型附加日志|


## Attachments:

[image2022-6-13_11-47-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjk4OTcwYzJhZjRmNTIxNjJjIiwicmVmX2lkIjoiNjczOTZkZjk1OTNmOTljOWZmMjM4MTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMjkzLCJleHAiOjE3ODIzOTk2OTN9.eRLBS2J9IIJiVm_rWjSUeLB3pw6mZVZ_38s31SQbbJ0)

 (image/png)    


[image2022-6-13_18-27-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZjlhMWFkOWEzMzExZGM5NDlmIiwicmVmX2lkIjoiNjczOTZkZjk1OTNmOTljOWZmMjM4MTJjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEzMjkzLCJleHAiOjE3ODIzOTk2OTN9.FbP7ViLFL-BnAUTTd5maelIC7jfJ3wXHzYhISHXKM3M)

 (image/png)    


## Comments:

|  [](null)  ,1、测试框架只能维护基础用例（纯ddl或纯dml）,2、add column之后，找不到新增列的元数据信息，所以addcolumn之后执行该列相关的操作无法解析，这是测试框架的bug,3、验证时对于每一个用例的观测点：,（1）事务XID的正确性,（2）语句的完整性（执行了的DDL/DML语句一定能解析出来）,（3）设定指定类型的附加日志时，记录的是该类型的信息，解析出来的也是该类型的信息,（4）执行DDL之后，后续dml是按照ddl之后的原则来进行的,4、一些比较复杂的数据类型（包括number/foat/interval/time/timestamp），在当前的测试框架中进行适配比较复杂，志宏这边帮忙实现了一些基础的，你们那边工具实现后需要关注一下这些数据类型，到时候我这边也会用你们的工具测一下这些数据类型。,时间类型的一些异常值，在解决方案工具那边需要做拦截，到时候需要测一下,5、逻辑复制中，LOB列禁止作为filter条件,6、当前测试框架解析BLOB数据有问题，解析带中文的CLOB数据有问题，解析单行过长的数据未适配，这部分场景在测试时需要注意；在后续断到端测试中需要覆盖,7、当前会改变元数据的操作：add column，rename column，rename table，drop partition, add partition，表中有数据时drop列,8、指定用户属性去做dml操作时，redo中不会记用户相关的信息，解析得到的逻辑日志中也没有用户相关信息,9、指定分区做dml操作的话是不会记录分区信息的，和普通表记录的一样,10、如果一个表是空的，truncate table其实啥也没做，也不记日志,Posted by zhanglihong at 六月 17, 2022 10:26|
|---|
|  [](null)  ,1、未支持的数据类型,（1）double的inf,（2）number类型,（3）time\interval类型,2、导入工具本身不支持的数据类型,（1）bit、raw,Posted by zhanglihong at 六月 17, 2022 18:06|
|  [](null)  ,和雷奇沟通后结论：,1、性能测试在SIT进行,2、EPC场景在SIT进行-----EPC已禁用,Posted by zhanglihong at 六月 22, 2022 15:35|
|  [](null)  ,1、LSC不支持的操作：,（1）rename/add/drop/modify column,（2）row movement,（3）BLOB/bit 数据类型,（4）update/delete操作,（5）index操作,（6）约束操作,（7）insert on duplicate key update,（8）create table as select,（9）merge into,（10）insert into select,（11）多表delete,（12）range分区转interval分区,Posted by zhanglihong at 六月 22, 2022 17:39|
|  [](null)  ,1、TAC不支持的操作,（1）lob类型，bit类型，raw类型,（2）merge into操作,（3）modify/drop primary key column,（4）外键,（5）insert_on_duplicate,Posted by zhanglihong at 六月 23, 2022 15:39|
|  [](null)  ,1、可加固测试点：,（1）库上已有行链接相关用例有必要跑一遍,（2）数据量比较大时的行链接场景有必要跑一遍,（3）列存支持merge into之后，需要验一下merge into行为解析后是否符号预期,（4）行链接场景在问题单回归完成之后需要把剩余场景再测试一遍,Posted by zhanglihong at 六月 24, 2022 17:19|
|  [](null)  ,列存是否支持如下操作？,1、coalesce操作是否支持？    
  2、回收站列存是否支持？,Posted by zhanglihong at 六月 29, 2022 18:11|
|  [](null)  ,导入工具可加固测试点：,（1）batch模式下可加强测试一下interval分区和二级分区,（2）可测一下多个分区场景下的数据导入（1M-1的边界值）,（3）char、varchar类型加索引，通过导入工具做导入的场景,Posted by zhanglihong at 八月 12, 2022 17:22|
|  [](null)  ,20221111：逻辑复制需要补测,1、LSC支持除insert之外的其它dml---这部分操作需要补充测试逻辑复制,2、AC对象的逻辑复制,Posted by zhanglihong at 十一月 11, 2022 10:05|
