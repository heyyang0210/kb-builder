Created by 江祉涵, last modified on 五月 06, 2023

###   [一、约束](#一约束)  

- 索引分区数与表分区数必须一致
- local后面不跟属性则创建默认local分区
- store in语句只能给hash分区表创建local索引
- 二级分区表空间情况根据以下规则决定：    
  1、若指定表空间的优先级未二级分区表空间>一级分区表空间>索引表空间    
  2、若均未指定表空间则跟随对应表的二级分区的表空间
- 二级分区指定segmentAttr情况与表空间相同，若不指定则为默认值
- 对于unique索引，一级分区键和二级分区键的并集需要是索引键的子集


###   [二、语法树](#二语法树)  

  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396b408970c2af4f520310/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBUUFBSUFBQUFBQUFBQUFBQUFBQ0FBQUlBQUFBQUFBQUFBQUFBQUFBSUFBQUlBQUFBQUFDQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBR0JBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIzMDgsImV4cCI6MTc4MjMwMzEwOH0.cRHZLKrxEgKmG6cZdwB0diQY4RWoIgmOsjJ-rryFZR4)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396b41a1ad9a3311dc8189/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBUUFBSUFBQUFBQUFBQUFBQUFBQ0FBQUlBQUFBQUFBQUFBQUFBQUFBSUFBQUlBQUFBQUFDQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBR0JBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIzMDgsImV4cCI6MTc4MjMwMzEwOH0.cRHZLKrxEgKmG6cZdwB0diQY4RWoIgmOsjJ-rryFZR4)

![](https://pingcode.yasdb.com/atlas/files/public/67396b41a1ad9a3311dc818a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBUUFBSUFBQUFBQUFBQUFBQUFBQ0FBQUlBQUFBQUFBQUFBQUFBQUFBSUFBQUlBQUFBQUFDQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBR0JBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTIzMDgsImV4cCI6MTc4MjMwMzEwOH0.cRHZLKrxEgKmG6cZdwB0diQY4RWoIgmOsjJ-rryFZR4)

###   [三、数据结构](#三数据结构)  

在indexpartdef里面新增一个list subparts存放所有subpartdict

```
typedef struct StIndexPartDef {
    union {
        // this flag will write to PARTOBJ$ table
        CodUint32 flags;
        struct {
            CodUint32 isLocal : 1;
            CodUint32 unused1 : 31;
        };
    };

    List* parts;  // individual partitions
    List* storedSpace;

    PartType     type;
    List*        partKeyCols;
    List*        subParts;
    PartBaseInfo baseInfo;
    CodUint8     indexType;
} IndexPartDef;

```

###   [四、测试用例](#四测试用例)  

|分区类型|测试场景|测试语句|测试结果|
|---|---|---|---|
|hash_hash    
    
|测试store in|create index hh_idx on HH_COMPOSITE(a) local store in (s1,s2);|创建成功|
||测试store in模板同时指定store in|create index hh_idx on HH_COMPOSITE(a) local store in (s1,s2)    
  (partition store in (s3,s4),partition store in (s3,s4));|创建成功|
||测试 partition store in |create index hh_idx on HH_COMPOSITE(a) local     
  (partition hh_pi1 store in (s3,s4),    
  partition hh_pi2 store in (s3,s4));|创建成功|
||测试 store in 模板 subparition |drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a) local store in (s1, s2)    
  (partition hh_pi1 (subpartition hh_subpi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|创建成功|
||测试 partition subpartition|drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 (subpartition hh_subpi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|创建成功|
||测试partition与表的partition个数不同|drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 (subpartition hh_subpi1, subpartition hh_subpi2));|报错与表的分区数不同|
||测试subpartition与表的subpartition个数不同|drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 (subpartition hh_subpi1),    
  partition hh_pi2 (subpartition hh_subpi3));|报错与表的分区数不同|
||测试 partition指定segment_attribute|drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 tablespace s1 pctfree 5 initrans 8 maxtrans 100(subpartition hh_subpi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|创建成功查询maxtrans与oracle相同没有更改|
||测试partition指定unusable subpartition不指定|drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 UNUSABLE(subpartition hh_subpi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|创建成功|
||测试partition 不指定unusable subpartition指定|drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 (subpartition hh_subpi1 unusable, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|创建成功|
||测试partition 指定unusable与subpartition 指定相反|drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 unusable(subpartition hh_subpi1 usable, subpartition hh_subpi2),    
  partition hh_pi2 usable(subpartition hh_subpi3 unusable, subpartition hh_subpi4));|创建成功|
||测试create online|create index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 (subpartition hh_subpi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4)) online;|创建成功|
||测试unique索引列为一级分区键|drop index hh_idx;    
  create unique index hh_idx on HH_COMPOSITE(a) local    
  (partition hh_pi1 (subpartition hh_subpi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|报错，分区键需要是unique索引列的子集|
||测试uniqu索引列为二级分区键|drop index hh_idx;    
  create unique index hh_idx on HH_COMPOSITE(b) local    
  (partition hh_pi1 (subpartition hh_subpi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|报错，分区键需要是unique索引列的子集|
||测试unique索引列为一级分区与二级分区建|drop index hh_idx;    
  create unique index hh_idx on HH_COMPOSITE(a,b) local    
  (partition hh_pi1 (subpartition hh_subpi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|创建成功|
||一级分区与二级分区重名|drop index hh_idx;    
  create index hh_idx on HH_COMPOSITE(a,b,a+b) local    
  (partition hh_pi1 (subpartition hh_pi1, subpartition hh_subpi2),    
  partition hh_pi2 (subpartition hh_subpi3, subpartition hh_subpi4));|报错重复子分区名|
|list-hash|测试store in|create index lh_idx on lh_composite(a) local store in (s1,s2);|成功|


##   [LOB](#lob)  

###   [1、约束](#1约束)  

- lob分区数和子分区数与表一致
- lob分区和子分区的表空间可以通过store as指定，若不指定则默认为表的
- lob列不能作为分区键或者子分区键


###   [2、数据结构](#2数据结构)  

修改数据结构StLobPart 新增标志位isPart记录lobpart是否有子分区，新增ObjectArray lobSubpart记录其子分区。

```
typedef struct StLobPart
{
    SsmDict   ssm;
    Btree*    indexPart;
    CodUint16 lobSlot;
    CodUint8  type;

    union {
        struct {
            CodUint32 isInterval: 1;
            CodUint32 isParted : 1;
            CodUint32 unusedProp: 30;
        };
        CodUint32    property;
    };

    ObjectArray* lobSParts;
} LobPart;

```

###   [3、测试用例](#3测试用例)  

|组合分区类型|sql语句|结果|
|---|---|---|
|hash_hash    
    
|create table hh_composite(a int, b clob)    
  partition by hash(a)    
  subpartition by hash(  a  )     
  (partition p1 tablespace s1 (subpartition subp1 tablespace s1, subpartition subp2 tablespace s2),     
  partition p2 tablespace s2 (subpartition subp3 tablespace s3, subpartition subp4 tablespace s4)) ;|创建成功|
|  
|create table hh_composite(a int, b clob) lob(b) store as (tablespace s1)    
  partition by hash(a)    
  subpartition by hash(a)     
  (partition p1 tablespace s1 (subpartition subp1 tablespace s1, subpartition subp2 tablespace s2),     
  partition p2 tablespace s2 (subpartition subp3 tablespace s3, subpartition subp4 tablespace s4)) ;|创建成功，lob子分区表空间为s1|
|  
|create table hh_composite(a int, b clob) lob(b) store as (tablespace s1)    
  partition by hash(a)    
  subpartition by hash(b)     
  (partition p1 tablespace s1 (subpartition subp1 tablespace s1, subpartition subp2 tablespace s2),     
  partition p2 tablespace s2 (subpartition subp3 tablespace s3, subpartition subp4 tablespace s4)) ;|报错，不能作为子分区|


  


## Attachments:

[CREATE INDEX 语法AnchorBase十一月 15, 2021image2021-8-27_11-37-4.png image2021-8-25_16-57-26.png indexAttr.png createIdx.png 语法示例：.url](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDBhMWFkOWEzMzExZGM4MTgzIiwicmVmX2lkIjoiNjczOTZiNDA1OTNmOTljOWZmMjM2MDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMzA4LCJleHAiOjE3ODIzNzg3MDh9.EOy7eACu_KU5mfqVfTPV50D1qO_-4RGVGALH9cjJtWg)

 (application/octet-stream)    


[image2021-8-27_15-46-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDBhMWFkOWEzMzExZGM4MTg0IiwicmVmX2lkIjoiNjczOTZiNDA1OTNmOTljOWZmMjM2MDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMzA4LCJleHAiOjE3ODIzNzg3MDh9.-S-wzljRGLlxIQ-b7obmVsDOq9mXcTmBeYJgGq40aqk)

 (image/png)    


[CREATEIDX_WITH_LOCAL.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDBhMWFkOWEzMzExZGM4MTg1IiwicmVmX2lkIjoiNjczOTZiNDA1OTNmOTljOWZmMjM2MDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMzA4LCJleHAiOjE3ODIzNzg3MDh9.NrpC-jDpiv_mc9WV35OHXFW0vVVqWEOvrc0Ql0leY3c)

 (image/png)    


[LOCAL_PARTITIONED_IDX.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDA4OTcwYzJhZjRmNTIwMzBlIiwicmVmX2lkIjoiNjczOTZiNDA1OTNmOTljOWZmMjM2MDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMzA4LCJleHAiOjE3ODIzNzg3MDh9.ejiT10KzKWzDLVN3XbYDV1-Jk0d1627ZMsWPSDqRBRc)

 (image/png)    


[IDX_PARTITION_ATTR.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDA4OTcwYzJhZjRmNTIwMzBmIiwicmVmX2lkIjoiNjczOTZiNDA1OTNmOTljOWZmMjM2MDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyMzA4LCJleHAiOjE3ODIzNzg3MDh9.g7JwziKiqXDsODLUX8Hj-AuwSZMzM_vHmSeIszQx3rE)

 (image/png)    
