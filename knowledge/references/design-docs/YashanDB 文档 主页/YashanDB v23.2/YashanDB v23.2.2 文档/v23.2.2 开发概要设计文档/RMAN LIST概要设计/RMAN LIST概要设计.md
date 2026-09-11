Created by 张旭涛, last modified on 四月 02, 2024

*IR链接：*    [[YDBRD-25501] yasrman查看备份信息输出支持格式化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-25501)  

*SR链接：*    [[YDBRD-26670] yasrman信息输出格式化 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-26670)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#1-%E6%80%BB%E8%BF%B0)  

yasrman支持list 命令以xml格式输出，方便使用脚本解析获取备份集的详细信息

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

鼎甲，友商达梦支持xml格式的输出。

###   [1.2 调研](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

** 调研达梦的list显示方式。 参考达梦的list xml显示方式**

  [RMAN LIST特性调研](https://conf.yasdb.com/pages/viewpage.action?pageId=147777108)  

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#2-%E6%8E%A5%E5%8F%A3)  

**   **  ** **  **LIST BACKUP [TAG tag_name]**  ** **  **[DETAIL [FORMAT XML]]**  **.**

  


![](https://pingcode.yasdb.com/atlas/files/public/67396caca1ad9a3311dc8c29/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI1MDcsImV4cCI6MTc4MjMxMzMwN30.seh5UttzlMzQbE5PkCLRKzgN5vYhgTY17XTJ3ss7q-M)

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1.  以detail关键字为标志，打印对应备份集的所有元数据信息，以xml格式呈现。
1. 支持集群、单机。（分布式待定）


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141579921#4-%E7%89%B9%E6%80%A7)  

  


当前备份集元数据信息

```
      <span class="hljs-class"><span class="hljs-keyword">struct</span> {</span>
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

        CodUint64 recId;  <span class="hljs-comment" style="color: rgb(136,136,136);">// rowid in backupset$</span>
        CodUint64 inputBytes;
        CodUint64 outputBytes;
        CodChar   tag[COD_NAME_BUFFER_SIZE];
        CodDate   resetTime;

        CodBool  isCluster;
        CodUint8 threadId;
        CodUint8 unused[<span class="hljs-number" style="color: rgb(136,0,0);">2</span>];

        CodUint32 instCnt;
        CodUint64 instMap;  <span class="hljs-comment" style="color: rgb(136,136,136);">// cluster instance topo map</span>

        CodBool   baseTagIncrBak;
        CodUint8  unused2[<span class="hljs-number" style="color: rgb(136,0,0);">3</span>];
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

## Attachments:

[image2023-11-15_9-19-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYWNhMWFkOWEzMzExZGM4YzI1IiwicmVmX2lkIjoiNjczOTZjYWM3MjgyMDZlZmI5MmYxNTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNTA3LCJleHAiOjE3ODIzODg5MDd9.7973ylNqQMjMJXW0VxeLL6vOgHqCVC1Dl8CYVFE0JlE)

 (image/png)    


[image2023-11-15_9-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYWNhMWFkOWEzMzExZGM4YzI2IiwicmVmX2lkIjoiNjczOTZjYWM3MjgyMDZlZmI5MmYxNTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNTA3LCJleHAiOjE3ODIzODg5MDd9.TgD7EN8BwziPjRWNyjCHHkjxEyLw4Hl_faCBCn10y1I)

 (image/png)    


[image2023-11-15_9-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYWNhMWFkOWEzMzExZGM4YzI3IiwicmVmX2lkIjoiNjczOTZjYWM3MjgyMDZlZmI5MmYxNTgzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAyNTA3LCJleHAiOjE3ODIzODg5MDd9.VJy6gyryIZ3HMoTh6jQeOkGD_ktHmk6H1OQA4vDH-08)

 (image/png)    
