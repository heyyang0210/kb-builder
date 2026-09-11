Created by 张旭涛, last modified on 十月 18, 2024

  


* IR链接：*    [[YDBRD-25501] yasrman查看备份信息输出支持格式化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-25501)  

*SR链接：*    [[YDBRD-26670] yasrman信息输出格式化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-26670)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#1-%E6%80%BB%E8%BF%B0)  

yasrman支持list 命令以xml格式输出，方便使用脚本解析获取备份集的详细信息

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

鼎甲，友商达梦支持xml格式的输出。

###   [1.2 调研](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

** 调研达梦的list显示方式。 参考达梦的list xml显示方式**

  [RMAN LIST特性调研](/pages/createpage.action?spaceKey=YAS&title=RMAN+LIST%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)  

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#2-%E6%8E%A5%E5%8F%A3)  

**    **  **LIST BACKUP [TAG tag_name]**  ** [DETAIL [FORMAT XML]]**  **.**

  


![](https://pingcode.yasdb.com/atlas/files/public/67396cc58970c2af4f520e3e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUNBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFVQUFBQUFBQUFBQUFBQWdBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFRQUFBQUFBQUNBSUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMTQsImV4cCI6MTc4MjMxNDExNH0.ECklt9YSAD8sKg78WcZF9WAQjYwXdz7o1S-A017Iz60)

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1.  以detail关键字为标志，打印对应备份集的所有元数据信息，以xml格式呈现。
1. 支持集群、单机，分布式。


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#4-%E7%89%B9%E6%80%A7)  

  


当前备份集元数据信息

```
      struct {
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
        EncrAlgo         encAlgo;
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
    };


```

  


需要list 打印的内容（单机、集群）

将当前备份集元数据信息全部打印，以xml格式呈现

  


##   [4. 1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#4-%E7%89%B9%E6%80%A7)    详细特性

打印单个备份集需要指定tag

yasrman sys/Cod-2022@127.0.0.1:1688 -c "list backup tag ‘test1’ detail " -D /home/catalog 

![](https://pingcode.yasdb.com/atlas/files/public/67396cc58970c2af4f520e3f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUNBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFVQUFBQUFBQUFBQUFBQWdBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFRQUFBQUFBQUNBSUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMTQsImV4cCI6MTc4MjMxNDExNH0.ECklt9YSAD8sKg78WcZF9WAQjYwXdz7o1S-A017Iz60)

  


打印所有的备份集，其中一个group表示一个备份集

  


![](https://pingcode.yasdb.com/atlas/files/public/67396cc5a1ad9a3311dc8caf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUNBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFVQUFBQUFBQUFBQUFBQWdBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFRQUFBQUFBQUNBSUFBQUFBQUFBQUFRPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMTQsImV4cCI6MTc4MjMxNDExNH0.ECklt9YSAD8sKg78WcZF9WAQjYwXdz7o1S-A017Iz60)

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


  


|测试用例|执行结果|
|---|---|
|yasrman sys/Cod-2022@127.0.0.1:1688 -c "list backup detail" -D /home/catalog   |<?xml version="1.0" encoding="UTF-8"?>    
  <backupsets>    
  <group>    
  <backup_type>DB_INCR</backup_type>    
  <backup_tag>bak11_yasrman_incre1_ser</backup_tag>    
  <backup_path>/data/regress/ha_regress/ha_home/node_1/backup/bak11_yasrman_incre1_ser</backup_path>    
  <connect_url>127.0.0.1:1601</connect_url>    
  <node_count>1</node_count>    
  <is_distribution>FALSE</is_distribution>    
  <is_rman_side>FALSE</is_rman_side>    
  <dbinfo>    
  <database_create_time>2024-04-02 10:00:46</database_create_time>    
  <database_id>2501914990</database_id>    
  <restore_time>NULL</restore_time>    
  <instance_count>1</instance_count>    
  <instance_map>1</instance_map>    
  </dbinfo>    
  <backupset>    
  <start_time>2024-04-02 10:01:39</start_time>    
  <complete_time>2024-04-02 10:01:40</complete_time>    
  <backup_path>/data/regress/ha_regress/ha_home/node_1/backup/bak11_yasrman_incre1_ser</backup_path>    
  <base_backup_path>/data/regress/ha_regress/ha_home/catalog/backup/bak11_yasrman_N1</base_backup_path>    
  <base_lsn>6173</base_lsn>    
  <backup_type>DB_INCR</backup_type>    
  <backup_level>1</backup_level>    
  <file_count>12</file_count>    
  <recover_begin>0-10-4-3347</recover_begin>    
  <flush_point>0-10-4-3347</flush_point>    
  <reset_point>0-0-0-0</reset_point>    
  <trunc_lsn>6177</trunc_lsn>    
  <flush_lsn>6177</flush_lsn>    
  <consistence_scn>549627902688165888</consistence_scn>    
  <base_lfn>3343</base_lfn>    
  <encryption_algorithm>AES128</encryption_algorithm>    
  <input_bytes>411283456</input_bytes>    
  <output_bytes>16792576</output_bytes>    
  <backup_tag>bak11_yasrman_incre1_ser</backup_tag>    
  <thread_id>0</thread_id>    
  <is_base_tag_incr_bak>FALSE</is_base_tag_incr_bak>    
  <instance>    
  <instance_id>1</instance_id>    
  <sequence_start>10</sequence_start>    
  <sequence_end>10</sequence_end>    
  </instance>    
  <scn_start>549627880830619648</scn_start>    
  <scn_end>549627902688165888</scn_end>    
  <create_time>2024-04-02 10:00:46</create_time>    
  <database_version>571</database_version>    
  <spc_import_scn>0</spc_import_scn>    
  <spc_import_lsn>0</spc_import_lsn>    
  </backupset>    
  </group>    
  </backupsets>|
|yasrman sys/Cod-2022@127.0.0.1:1688 -c "list backup tag ‘test1’ detail " -D /home/catalog   ||
|yasrman sys/Cod-2022@127.0.0.1:1688 -c "list backup tag ‘test1’ detail  format xml " -D /home/catalog   ||


## Attachments:

[image2024-1-29_10-30-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzU4OTcwYzJhZjRmNTIwZTNhIiwicmVmX2lkIjoiNjczOTZjYzQ3MjgyMDZlZmI5MmYxNjhiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMzE0LCJleHAiOjE3ODIzODk3MTR9.yNOZebRltQKf0K15RDiLZl3Tzs7F2pRJVJ4zwgKy-Ww)

 (image/png)    


[image2024-1-29_10-30-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzU4OTcwYzJhZjRmNTIwZTNiIiwicmVmX2lkIjoiNjczOTZjYzQ3MjgyMDZlZmI5MmYxNjhiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMzE0LCJleHAiOjE3ODIzODk3MTR9.-dDwEDCj-Yy-cgtNhHYosVSVdcaMUMB8eWXOaxGp7xU)

 (image/png)    


[image2024-4-2_10-35-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzVhMWFkOWEzMzExZGM4Y2FlIiwicmVmX2lkIjoiNjczOTZjYzQ3MjgyMDZlZmI5MmYxNjhiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMzE0LCJleHAiOjE3ODIzODk3MTR9.WDJF1Km1AiD4CEjY6KbB5B4cCOTNRJS6o_t8dELJajc)

 (image/png)    


## Comments:

|  [](null)  ,与会人：马志宏、张旭涛、高亚宁、刘丹、刘大境    
  会议时间：2024.04.06    
  会议地点：线下会议,会议纪要：,1.备份相关视图内容和list的必须保持一直,2.归档备份的scn范围和sequence范围是否一致,3.旧版本的catalog升级使用list显示是否存在问题,Posted by zhangxutao at 四月 07, 2024 11:20|
|---|
