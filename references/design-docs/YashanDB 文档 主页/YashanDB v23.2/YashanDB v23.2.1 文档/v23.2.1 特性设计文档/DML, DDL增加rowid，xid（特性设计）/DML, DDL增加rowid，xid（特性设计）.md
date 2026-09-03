Created by 马志宏, last modified on 十二月 12, 2023

#   [YDBRD-21830 : DML，DDL附加日志添加rowid，xid](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#ydbrd-21627--%E6%95%B0%E6%8D%AE%E5%BA%93%E7%BA%A7%E9%99%84%E5%8A%A0%E6%97%A5%E5%BF%97-%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)    设计

SR链接：    [YDBRD-21830](https://jira.yasdb.com/browse/YDBRD-21830?src=confmacro)    -  DML，DDL附加日志添加rowid，xid  完成

调研文档：不涉及

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#1-overview%E6%A6%82%E8%BF%B0)  

YashanDB的附加日志里，没有rowid和xid。对于DSG等第三方厂商来说，需要这些信息去解析事务，因此需要增加这些信息。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1. HEAP DML增加rowid，xid
1. TAC DML增加rowid，xid
1. LSC DML增加rowid，xid
1. DDL 增加xid


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
typedef struct StLogMinerDML {
    CodUint64    objectId;
    CodUint64    rowid; // 新增rowid返回值
    CodUint32    ssn;
    LogMinerCols data;
    LogMinerCols where;
} LogMinerDML;
```

  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1. LSC的rowid，同一行数据在变为冷数据后，会发生变化，不可做where条件。
1. HEAP的表，在shrink之后，同一行的rowid也可能变化。
1. 跨分区更新后，同一行的rowid可能会变。
1. xid在logminer框架不感知，主要是给DSG直接解析redo文件用。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#51-architecture%E6%9E%B6%E6%9E%84)  

1. 在DML的附加日志里，在logicFlag上标记是否带xid和rowid，新版本带，旧版本不带
1. DDL的附加日志redo类型新增一个，加上xid
1. 在长索引的附加日志里，增加xid
1. 在lob块的附加日志里，增加xid


###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#52-data-structures--flow%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84%E4%B8%8E%E6%B5%81%E7%A8%8B)  

```
typedef struct StSwfLogicRdRowId {
    union {
        SliceRowId sliceId;  // 冷数据的rowid
        DataRowId  rowId;    // 热数据的rowid
    };

    CodUint64 affect;
    CodUint8  type;  // BATCH, FULL_BATCH, SLICE
    CodUint8  unused[3];
} SwfLogicRdRowId;

typedef struct StRecLogicEnd {
    CodUint8  success : 1;
    CodUint8  xmap : 1;  // 是否带xid
    CodUint8  unused : 6;
    CodUint8  reserved[3];
} RecLogicEnd; 

 // 新增lob redo类型，之前废弃
typedef struct StRecLobAppendData {
    CodUint64 lobId; // 新增字段
    Xid       xid;   // 新增字段
    CodUint16 size;
    CodUint16 unused;
    CodChar   data[2];
} RecLobAppendData;
```

1. logminer解析时，如果logicFlag没有xid，rowid标记，则是旧版本redo，将rowid设为0
1. logminer解析时，如果logicFlag有xid，rowid标记，则是新版本redo，先解析xid和rowid，再解析其他


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#53-compatibility%E5%85%BC%E5%AE%B9%E6%80%A7)  

- 附加日志新增rowid，xid后，是新增日志类型，原有redo类型回放函数依然保留，不影响兼容性。
- logminer可以兼容新旧版本两种redo类型，旧版本redo的rowid是0。
- logminer接口和YDS的版本一致时，不会有兼容问题。


###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#54-dfx%E8%AE%BE%E8%AE%A1)  

1. 权限：不涉及
1. 性能：REDO变大，开了附加日志后，可能会轻微影响性能。


###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#55-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

ha_regress里已经支持rowid的显示，在logminer的run log里，也有rowid的显示。

|  
|  
|场景|预期|备注|
|---|---|---|---|---|
|功能测试    
    
    
    
    
    
|基本功能    
    
    
    
    
    
|开启任意模式的附加日志，执行表，VIEW，物化视图，存储过程的DDL|DDL都可以被解析|  
|
|||开启MIN模式附加日志，执行DML|HEAP，TAC，LSC记录rowid|  
|
|||开启PRIMARY KEY模式附加日志，执行DML->执行DML|按顺序尝试记录：主键→ 非空唯一索引→ 整行，以及rowid|  
|
|||开启ALL模式附加日志，执行DML|记录整行和rowid|  
|
|||LSC插入后，等转换为冷数据后，再去update或delete|insert的rowid和update的rowid，可能不一样|  
|
|||heap shrink table，构造row迁移的场景|同一行的rowid可能会变|  
|
|||分区表跨分区更新|同一行的rowid可能会变|  
|
|兼容性|  
|22.2版本执行一些业务（表级附加），升级到此版本，再执行业务。然后从最老的redo开始解析|不core，解析正常|  
|


  


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

logminer目前为内部工具接口，没有对外文档。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=133568278#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

![](plugins/servlet/confluence/placeholder/unknown-attachment?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg3MjksImV4cCI6MTc4MjMwOTUyOX0.WgAh3dE-ThkDXA9TARQcwygv2Ofl2MsABn0vfRdFeRY)

## Comments:

|  [](null)  ,会议纪要：,1. 增加兼容性测试场景
1. ha regress的rowid space的随机性处理
,Posted by mazhihong at 十二月 12, 2023 17:42|
|---|
