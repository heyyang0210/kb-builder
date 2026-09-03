Created by 万谦, last modified on 十一月 06, 2023

#   [支持分布式一级分区表AC](#支持分布式一级分区表ac)  

JIRA：    [YDBRD-22334](https://jira.yasdb.com/browse/YDBRD-22334)  

##   [1. Overview（概述）](#1-overview概述)  

​		当前系统内的AC存储表空间和主表保持一致，不满足分布式特性，另外目前AC在创建时不支持延迟创建方式，这两个缺陷都在扩缩容时造成很大阻力。因此，需要使分区表下的AC分区和所在分区表空间保持一致，保证在迁移的时候chunk上所有的对象可以随着chunk一起迁移，还要支持延迟创建，适配目前的元数据迁移思路。

##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|分区表的AC表空间和所在分区一致|AC所在表空间和所在分区一致|分布式下AC更符合目前的chunk存储思路 并且便于数据迁移|
|AC支持延迟创建|新创建AC时不创建对应数据段 只在后台ac数据生成时创建|适配表空间元数据迁移时对象必须支持延迟创建特征 此外可一定程度节省表空间|
|表空间带AC支持扩缩容|存在AC的数据库系统可进行扩缩容|补齐分布式扩缩容能力 凸显AC优势|


另外在AC的扩缩容适配中 需支持transport AC和reclaim AC的相关语法

![](https://pingcode.yasdb.com/atlas/files/public/67396c5b8970c2af4f520b6c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFnQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFRQUFBQkFBQkFBZ0lBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUFBQUFRQUlBSUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzOTQsImV4cCI6MTc4MjMxMTE5NH0.uMpbGZWL9uKnLsyOeZo3OBRCmMjWR74BQxFJ0lLiKbQ)

![](https://pingcode.yasdb.com/atlas/files/public/67396c5b8970c2af4f520b6d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFnQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFRQUFBQkFBQkFBZ0lBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUFBQUFRQUlBSUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzOTQsImV4cCI6MTc4MjMxMTE5NH0.uMpbGZWL9uKnLsyOeZo3OBRCmMjWR74BQxFJ0lLiKbQ)

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
// 获取迁移transport ac元数据
static CodResult exportTtsAcs(AnlStmt* stmt, List* tsList, GetDdlAssist* getDdlAssist)

// 获取迁移reclaim ac元数据
static CodResult reclaimTtsAcs(AnlStmt* stmt, List* tsList, GetDdlAssist* getDdlAssist)

// transport ac所需接口
CodResult parseTransportAc(AnlParser* parser, LangWord* word) 

// alter ac所需接口
CodResult parseAlterAc(AnlParser* parser, LangWord* word)
CodResult verifyAlterAc(AnlVerifier* vrfr, CodPointer ctx)
CodResult execAlterAc(AnlStmt* stmt)

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 只支持适配一级分区表AC的相关能力


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

5.2.1 数据结构

```
typedef struct StAllAcVars {
    Variant* acOid;
    Variant* acOwner;
    Variant* acName;
    Variant* tableOwner;
    Variant* tableName;
    Variant* acType;
    Variant* allColCount;
    Variant* inColCount;
    Variant* outColCount;
    Variant* acTsName;
    Variant* bound;
    Variant* sortType;
    Variant* filer;
    Variant* spaceId;
    Variant* sharded;
} AllAcVars;

```

​    以上结构体是在transport AC过程中有关AC对象的具体含义，在迁移元数据阶段，根据此结构体上面的内容可以还原出AC创建的语句。仿照其它对象的transport流程，将语句发送给迁移目标端即可做到AC的定义元数据迁移。

```
typedef struct StTtsReclaimAcVars {
    Variant* partitioned;
    Variant* spaceName;
} TtsReclaimAcVars;

typedef struct StTtsReclaimPartAcVars {
    Variant* partName;
    Variant* spaceName;
} TtsReclaimPartAcVars;

```

​    类似的，reclaim AC结构体上面的内容是针对普通和分区AC的数据段元数据内容，利用此内容可以拼接出ALTER ACCESS CONSTRAINT RECLAIM后续子句，同样发送完整的语句即可做到AC的数据段元数据迁移。

```
typedef struct StAcDef {
    LangText   acOwnerName;
    LangText   acName;
    LangText   tabOwnerName;
    LangText   tableName;
    ...
    CodBool    isTransport;
    CodUint8   unused[7];
    // partitons ...
} AcDef;

```

​    执行Transport AC的语法和create AC的语法几乎一样，数据结构上只在AcDef内增加isTransport标识，指导后续执行据此走到transport的特殊逻辑。

```
typedef enum EnAlterAcAction {
    ALTER_AC_RECLAIM_SEG = 0,
    ALTER_AC_RECLAIM_PART_SEG,
} AlterAcAction;

typedef struct StReclaimSegDef {
    LangText     name;
    SegmentDef   seg;
    CodUint64    partId; // for interval partitions
    List*        partList;
    List*        lobSegList;
    List*        segList;
    List*        xfmrList;
    List*        simList;
    SpaceBlockId auxEntry;
} ReclaimSegDef;

typedef struct StAlterAcDef {
    AlterAcAction action;
    LangText      acOwnerName;
    LangText      acName;
    CodUint64     objectId;
    CodUint64     tabVersion;
    CodUint64     tabOid;
    union {
        List* reclaimSegDef;  // for reclaim segment while duplicate space
    };
} AlterAcDef;

```

​    为支持ALTER AC RECLAIM语法和功能，新增AlterAcDef结构体，其中的action字段表示是针对普通还是分区AC的reclaim行为，acOwnerName和acName指向了要alter的对象，tabVersion和tabOid为AC的父表信息，最后reclaimSegDef上记录了reclaim的具体对象和具体元数据信息。

5.2.2 流程

（1）transport AC元数据获取流程

​      transport AC的元数据获取分为单机和分布式两种场景

​    对于单机，需要按照迁移表空间的限制来获取表空间内的AC定义，而分布式则是数据库内所有的AC定义都要获取出来。因此，这里只介绍分布式下AC的transport元数据如何获取，单机的获取流程就是分布式获取流程内加上迁移表空间的限制。

- step1：从AC$内获取所有AC的基础信息
- step2：依据基础定义信息还原创建语句
- step3：根据AC id和关联查询到ACCOL$内的特殊子句定义
- step4：将特殊子句拼接到创建语句内


（2）reclaim AC元数据获取流程

​    reclaim AC的元数据在单机和分布式上面的流程一样，总的来说就是以迁移的chunk或表空间的spaceid为限制找到此限制下所有AC的数据段元数据并且生成对应的reclaim语句。

- step1：根据spaceid获取需要进行reclaim的AC对象名
- step2：根据AC对象名从dba_segments获取数据段信息
- step3：获取AC对象附属结构的数据段信息（包括分区和col_seg内的元数据
- step4：用获取的数据段元数据信息生成ALTER RECLAIM的语句


（3）transport AC执行流程和细节

​    transport AC执行流程和AC的创建一致，此处不再赘述。

​    和之前的唯一区别是数据段都会进行延迟创建，只有后台任务发现需要生成并插入AC数据时，AC的seg才会创建出来。

​    另外需要注意的一点，  **transport的所产生AC不允许后台访问到**  ，防止目标端在AC进行reclaim前自己又生成了一份数据。

（4）alter AC reclaim执行流程和细节

​    alter AC reclaim是此需求重点。

​    同表对象一样，AC对象在迁移时也是通过挂载数据段信息的方式完善元数据信息。源端发送给目标端的reclaim语句在目标端同样进行解析、校验和执行三个阶段。

​    【1】解析阶段是对reclaim语句的信息解析，流程见如下伪代码。

```
input: parser,word
output: AlterAcDef

while word not is eof do:
    read ac objectInfo;
    if success:
        create reclaim_seg_info list on AlterAcDef;
        if ac is partitioned:
            AlterAcDef.action = ALTER_AC_RECLAIM_PART_SEG;
            while read partition name do:
                parse Ac partition seg_reclaim_info;
            end
        else:
            AlterAcDef.action = ALTER_AC_RECLAIM_SEG;
            parse Ac seg_reclaim_info;
        end
    else:
        return error;
    end
end

```

​    其中的seg_reclaim_info包含一个对象的所有数据段信息，以下举例sql展示了具体内容，包含对象表空间信息、对象入口页信息、辅助子结构的数据页信息等。

```
ALTER ACCESS CONSTRAINT "SYS"."TEST_AC_DUP1" RECLAIM SEGMENT TABLESPACE TEST_DUP7 OBJNO_REUSE 2257 SEG_FILE 0 SEG_BLOCK 128  COLSEGS ( DATAOBJ 2258 TYPE 3 ID 0 ENTRY 10752 FLAG 0 DATAOBJ 2258 TYPE 0 ID 0 ENTRY 11264 FLAG 0 DATAOBJ 2257 TYPE 3 ID 0 ENTRY 40960 FLAG 0 DATAOBJ 2257 TYPE 0 ID 0 ENTRY 41472 FLAG 0 DATAOBJ 2260 TYPE 3 ID 0 ENTRY 68096 FLAG 0 DATAOBJ 2260 TYPE 0 ID 0 ENTRY 68608 FLAG 0)；

```

​    【2】校验阶段是对recliam的信息初步校验，包含AC对象存在性检查、alter类型异常检查和reclaim_info信息的大致检测。其中reclaim_info信息只检查是否和对象的分区属性匹配的上。

​    【3】执行阶段

​    由于分布式的加锁限制，在reclaim阶段不允许对迁移对象或父表对象上排它锁，而在单机上没有此限制，因此，目标端是单机和分布式DN组的ac reclaim的执行流程有所不同：

​    

![](https://pingcode.yasdb.com/atlas/files/public/67396c5ba1ad9a3311dc89da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFnQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFRQUFBQkFBQkFBZ0lBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUFBQUFRQUlBSUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzOTQsImV4cCI6MTc4MjMxMTE5NH0.uMpbGZWL9uKnLsyOeZo3OBRCmMjWR74BQxFJ0lLiKbQ)

​    如上图所示，ac的reclaim过程主要包含两个步骤：更新ac元数据和ac dict重载。

​    更新ac元数据，就是将源端发送过来的ac表空间和数据页entry信息填入到对应的系统表内。ac dict重载就是利用正确的元数据信息在目标端加载完整的ac cache信息，两个步骤完成，目标端的ac即实现了迁移，后续就可正常访问使用。

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

不涉及兼容性变更

###   [5.4 DFX设计](#54-dfx设计)  

可测试点：

（1）提供内置函数获取AC迁移时的元数据进行自测校验

​    dbms_tts_metadata.get_tts_ddl

​    dbms_reclaim_metadata.get_reclaim_ddl

![](https://pingcode.yasdb.com/atlas/files/public/67396c5b8970c2af4f520b6e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBZ0FBQUFBQUFnQUFBQUFDQUFBQUFBQkFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFRQUFBQkFBQkFBZ0lBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUlDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBSUFBQUFBQUFRQUlBSUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDAzOTQsImV4cCI6MTc4MjMxMTE5NH0.uMpbGZWL9uKnLsyOeZo3OBRCmMjWR74BQxFJ0lLiKbQ)

（2）dba_segments内可展示AC对象相关信息

（3）AC的延迟创建能力可以从dba_segments体现

（4）分区表AC表空间和分区一致可查询acpart$和tabpart$信息确认 dba_aces和dba_ac_parts

（5）DN扩缩容带AC成功和正确性验证

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

明确分布式下可支持带AC的扩缩容

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

二级分区适配

## Attachments: