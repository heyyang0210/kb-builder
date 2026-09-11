Created by 高亚宁, last modified by  刘丹 on 四月 25, 2024

## 1.   **概述**

-   [1. 概述](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-1.概述)  
-   [2. 需求分析 ](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-2.需求分析)  
    -   [2.1 SR：yasrman信息输出格式化](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-2.1SR：yasrman信息输出格式化)  
    -   [2.2 语法：](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-2.2语法：)  
-   [3. 测试设计方法 ](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-3.测试设计方法)  
    -   [3.1 特性关联领域分析：](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-3.1特性关联领域分析：)  
    -   [3.2 测试设计：](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-3.2测试设计：)  
-   [4. 详细测试设计   ](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-4.详细测试设计)  
    -   [4.1  语法：主要全部有效语法，覆盖常见的语法错误](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-4.1语法：主要全部有效语法，覆盖常见的语法错误)  
    -   [4.2  功能：语法正确，覆盖各种备份类型](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-4.2功能：语法正确，覆盖各种备份类型)  
-   [5. 测试用例](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-5.测试用例)  
-   [6. 测试框架设计](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-6.测试框架设计)  
-   [7. 测试环境说明](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-7.测试环境说明)  
-   [8. 工作量评估](#id-【YDBRD25501】yasrman查看备份信息输出支持格式化测试设计-8.工作量评估)  


本文描述yasrman查看备份信息输出支持格式化的测试设计

现状：  list backup tag xxx，如下图所示，会显示备份集的基本信息，scn等，不会显示显示更详细的信息（备份时间，asn等）

![](https://pingcode.yasdb.com/atlas/files/public/67396cbba1ad9a3311dc8c86/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBUUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMwMzYsImV4cCI6MTc4MjMxMzgzNn0.IC0Hoxwcah4RMLUk8GZHl_cOEvG2qraSLixqhYKclHU)

该需求实现后：  list backup tag xxx  原格式不变；  LIST BACKUP [TAG tag_name] [DETAIL [FORMAT XML]]  会以xml格式输出，显示更详细的信息（备份时间，asn，scn等），方便第三方解析备份集信息。

## 2.   **需求分析**

### 2.1 SR：  yasrman信息输出格式化

链接：        [YDBRD-26670](https://jira.yasdb.com/browse/YDBRD-26670?src=confmacro)    -  yasrman信息输出格式化  设计中

设计文档：    [RMAN LIST特性设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147777105)      


场 景：  list backup tag xxx    


功能：  yasrman查看备份信息输出格式化，"list backup tag xxx"输出格式化（类似xml），显示更详细的信息（备份时间，asn，scn等），  方便第三方解析备份集信息

需求范围：单机和集群，yasrman

功能限制：

1.  以detail关键字为标志，打印对应备份集的所有元数据信息，以xml格式呈现。
1. 支持集群、单机、分布式


### **2.2 语法：**

** **  **LIST BACKUP [TAG tag_name]**  ** **  **[DETAIL [FORMAT XML]]**

例如：

yasrman sys/Cod-2022@127.0.0.1:1688 -c "list backup detail" -D /home/catalog

yasrman sys/Cod-2022@127.0.0.1:1688 -c "list backup tag ‘test1’ detail " -D /home/catalog

yasrman sys/Cod-2022@127.0.0.1:1688 -c "list backup tag ‘test1’ detail  format xml " -D /home/catalog

## 3.   **测试设计方法**   

### 3.1 特性关联领域分析：

该需求是为了鼎甲适配用，对list backup功能的增强，功能点较简单（研发设计上参考达梦），主要是  将当前备份集元数据信息全部打印，以xml格式呈现，  从该功能本身出发测试即可，重点测试不同类型的备份集，元数据信息是否正确（与dba_backup_set、dba_archive_backupset相互佐证），生成的xml格式能否被正确解析，主要考虑以下几个方面：

```
CodUint32 checksum;
        CodUint32 version;
        CodDate   startTime;
        CodDate   completeTime;
        FileName  backupPath;
        FileName  baseBackup;
        CodUint64 baseLsn;

        CodUint8  type;
        CodUint8  level;
        CodBool   isDistribute;
        CodUint8  reserved;
        CodUint32 fileCount;

        RdPoint   rcyBegin;
        RdPoint   flushPoint;
        RdPoint   resetPoint;
        CodUint64 truncLsn;
        CodUint64 flushLsn;
        AnkScn    scn;

        CodUint32        incrementId;
        CodUint64        baseLfn;
        CodUint64        fileListSize;
        CompressionType  compressType;
        CompressionLevel compressLevel;
        EncrAlgo         encAlgo
        CodChar          pwCheckKey[BAK_ENCRYPTION_KEYLEN];

        CodUint64 recId;  // rowid in backupset$
        CodUint64 inputBytes;
        CodUint64 outputBytes;
        CodChar   tag[COD_NAME_BUFFER_SIZE];
        CodDate   resetTime;

        CodBool  isCluster;
        CodUint8 threadId;
        CodUint8 unused[2];

        CodUint32 instCnt;
        CodUint64 instMap;  // cluster instance topo map

        CodBool   baseTagIncrBak;
        CodUint8  unused2[3];
        CodUint32 dbid;
        CodDate   restoreTime;

        CodUint32 sequenceStart[ANK_MAX_INSTANCES];
        CodUint32 sequenceEnd[ANK_MAX_INSTANCES];
        AnkScn    scnStart;
        AnkScn    scnEnd;
        CodDate   createTime;
        CodUint32 dbVersion;
        AnkScn    spcImportScn;
        CodUint64 spcImportLsn;
```

  


1. 部署形态：单机、集群、分布式
1. list backup新增detail部分的语法测试，报错要简单明确
1. 不同类型的备份集（全量、增量、差量、指定基线增量、归档备份、dest client/server、是否加密、是否压缩），list backup展示的xml信息是否正确（与dba_backup_set、dba_archive_backupset中显示的值一致），能否被解析——设计考虑：不同类型的备份集，元数据信息不一样，会影响元数据信息里的字段值
1. 梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点


|专项|是否涉及|
|:---|:---|
|并发|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|
|资料|是|
|升级场景|是|


### 3.2 测试设计：

语法部分采用等价类划分法，功能部分采用场景法

## 4.   **详细测试设计**

### 4.1      语法：主要全部有效语法，覆盖常见的语法错误

|输入条件|有效等价类|无效等价类|
|:---|:---|:---|
|list backup DETAIL（显示所有备份集信息）|LIST BACKUP DETAIL，显示所有备份集的信息|DETAIL拼写错误|
|  
|  
|DETAIL重复|
|  
|LIST BACKUP DETAIL FORMAT XML，大小写混合，显示所有备份集的信息|FORMAT缺失：LIST BACKUP DETAIL XML|
|  
|  
|xml缺失：LIST BACKUP DETAIL FORMAT|
|  
|  
|DETAIL缺失：LIST BACKUP FORMAT XML|
|  
|  
|FORMAT、xml写错或者重复|
|  
|  
|FORMAT XML相对位置不对：LIST BACKUP FORMAT XML DETAIL |
|LIST BACKUP  TAG tag_name DETAIL [FORMAT XML]]（显示指定的备份集信息）|LIST BACKUP  TAG ’test‘ DETAIL，只显示指定的备份集test的信息|DETAIL拼写错误|
|  
|LIST BACKUP  TAG 'test' DETAIL FORMAT XML，大小写混合，只显示指定的备份集test的信息|DETAIL重复|
|  
|  
|FORMAT缺失：LIST BACKUP  TAG ’test‘  DETAIL XML|
|  
|  
|xml缺失：LIST BACKUP TAG ’test‘  DETAIL FORMAT|
|  
|  
|DETAIL缺失：LIST BACKUP TAG ’test‘  FORMAT XML|
|  
|  
|FORMAT、xml写错或者重复|
|  
|  
|FORMAT XML相对位置不对：LIST BACKUP TAG 'test'  FORMAT XML DETAIL ,LIST BACKUP  DETAIL FORMAT XML TAG 'test' ,LIST BACKUP TAG 'test'  FORMAT XML DETAIL|


### 4.2  功能：语法正确，覆盖各种备份类型

|  
|测试场景|用例详细描述|预期|备注|
|:---|:---|:---|:---|:---|
|14|单机|做普通全量备份（不带压缩不带加密属性，指定tag，format），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|incrementId应该为0|
|  
|  
|做普通level 0的增量备份（不带压缩不带加密属性，指定tag，format），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|incrementId  应该为1|
|  
|  
|做普通level 1的增量备份（不带压缩不带加密属性，指定tag，format），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|incrementId  应该为1|
|  
|  
|做普通差量备份（不带压缩不带加密属性，指定tag，format），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|差量备份集由哪个字段标识？？|
|  
|  
|做全量备份（带压缩带加密属性，指定tag，format），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|compressType,compressLevel,encAlgo,pwCheckKey|
|  
|  
|做level 0的增量备份（带压缩带加密属性，指定tag，format、dest server），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|  
|
|  
|  
|做level 1的增量备份（带压缩带加密属性，指定tag，format、dest client），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|  
|
|  
|  
|做差量备份（带压缩带加密属性，指定tag，format、dest client），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|  
|
|  
|  
|~~查看指定基线增量备份集信息：~~,1. ~~做level 0的增量备份集A（带压缩带加密属性，指定tag，format、dest client），带independ字段，查看该备份集~~
1. ~~做level 0的增量备份B（带压缩带加密属性，指定tag，format、dest client），base on ’A‘，查看该备份集~~
|~~2个备份集xml信息全部正确，能被解析~~|yasrman不支持指定基线增量备份，不需要测试|
|  
|  
|restore db后，做全量备份（带压缩带加密属性，指定tag，format），查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|type,restoreTime|
|  
|  
|restore db后，做归档备份，查看该备份集xml信息是否正确，能否被解析|备份集xml信息全部正确，能被解析|type,restoreTime|
|  
|  
|查看所有备份集信息：list backup DETAIL FORMAT XML|所有备份集的xml信息全部正确，能被解析|  
|
|  
|+|备份集很多，内存不足时查看|xml打印报错|加故障点——旭涛,优先级低|
|  
|+|表空间迁移场景，影响spc_import_scn和spc_import_lsn|迁移后，xml中的spc_import_scn和spc_import_lsn会变化|  
|
|  
|集群|覆盖以上场景|  
|**对于归档备份集，集群上会显示所有实例的scn信息，与单机不一致，需要重点关注**|
|  
|分布式|覆盖以上场景|  
|  
|
|15|升级场景|22.2和23.1版本的增量备份集，升级到23.2.1版本，list backup detail查看备份集|22.2和23.1版本报错,23.2.1版本xml显示备份集的元数据信息，能够正确解析|备份集不支持跨版本恢复,新增字段显示为0|


## 5.   **测试用例**

测试设计细化后的文本用例

[yasrman信息输出格式化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmI4OTcwYzJhZjRmNTIwZTE3IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDM2LCJleHAiOjE3ODIzODk0MzZ9.IrLXT5UfXo1H2WEQ4cgPIcl5BMmhghImkQEsPKy8v5A)

## 6.   **测试框架设计**

使用已有的ha_regress测试框架

  [https://git.yasdb.com/cod-x/anchor_regress/-/tree/master/ha_regress](https://git.yasdb.com/cod-x/anchor_regress/-/tree/master/ha_regress)  

需要新增接口：  解析xml格式文件，和dba_backup_set中内容对比，来校验xml的内容是否正确

## 7.   **测试环境说明**

使用linux操作系统安装yasdb， 对于环境配置无要求

## **8. 工作量评估**

总计6人天：

测试设计+评审：1人天

接口开发和调试：1人天

单机：1.5人天

集群：0.5人天

分布式：1人天（框架不一样，建议用ha_regress部署分布式环境，参考文亮的用例，单机用例可复用）

上车+CI分析：1人天（和YDBRD-26669一起上车）——代码已合入，不用跑上车

## Attachments:

[yasrman信息输出格式化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmI4OTcwYzJhZjRmNTIwZTE5IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDM2LCJleHAiOjE3ODIzODk0MzZ9.-ffk4vCbiINtHKbaE-9-aqiYcwQBv_KPzhetU0Ed4kw)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[yasrman信息输出格式化文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYmI4OTcwYzJhZjRmNTIwZTE3IiwicmVmX2lkIjoiNjczOTZjYmI1OTNmOTljOWZmMjM3MjZiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMDM2LCJleHAiOjE3ODIzODk0MzZ9.IrLXT5UfXo1H2WEQ4cgPIcl5BMmhghImkQEsPKy8v5A)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,该特性属于成熟模块的小特性，因此概要设计和详细设计合一,Posted by gaoyaning at 四月 03, 2024 09:09|
|---|
|  [](null)  ,与会人：马志宏、张旭涛、高亚宁、刘丹、刘大境    
  会议时间：2024.04.06    
  会议地点：线下会议,会议  纪要：,1. 新增测试点：备份集很多，内存不足时查看
1. 差量备份集由哪个字段标识？——  baseBackup为全量备份集、  incrementId  为1
,Posted by gaoyaning at 四月 08, 2024 14:23|
