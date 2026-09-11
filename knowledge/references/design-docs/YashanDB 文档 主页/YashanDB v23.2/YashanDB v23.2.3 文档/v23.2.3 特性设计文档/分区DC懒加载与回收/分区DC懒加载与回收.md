Created by 张锐, last modified on 四月 18, 2024

IR:    [YASHAN-896  支持分区DC按需加载，引入淘汰机制](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b2d0)  

##   [1. Overview（概述）](#1-overview概述)  

支持分区dc独立回收，分区表dc按需加载。

拆分2个SR开发：

-   [YDBRD-19732 支持分区DC懒加载](https://pingcode.yasdb.com/pjm/items/66115d3b579a3edb84d6b27d)    ：调整dc结构，分区表dc懒加载，但是回收还是按照之前逻辑，按表回收
-   [YDBRD-26175 支持分区DC淘汰](https://pingcode.yasdb.com/pjm/items/6618e863fd997db58ad82f27)    ：实现分区dc可单独回收


##   [2. Features（功能特性）](#2-features功能特性)  

- 分区dc独立mctx
- 分区dc懒加载
- 分区dc支持回收


##   [3. Interfaces（接口）](#3-interfaces接口)  

无

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

临时表dc？（已确认，没影响。 ptt自己构造dc，gtt和普通表一样，区别在于加载上来的entry是invalid，从内存里拿entry，与懒加载不冲突）

###   [DC结构修改，按需加载](#dc结构修改按需加载)  

- 依然使用一个mctx
- 一级分区的partbound使用表dc的mctx，挂在partdict上
- 表dc加载需要加载一级分区的partbound，以及hash结构，同时创建一级分区dc的list，填NULL
- 一级分区加载需要加载对应二级分区的partbound，同时创建二级分区dc的list，填NULL
- 二级分区加载的时候，一级分区一定已经加载
- nt目前是与表dc公用一个mctx，暂时保持不变（nt当前只创建一级分区，不创建二级分区。 nt dc加载一次性全部加载。目前nt dc不能单独回收，只能依附表）
- 分区统计信息在表dc上，可以加载


![](https://pingcode.yasdb.com/atlas/files/public/67396d658970c2af4f52127b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFJQUFBSUFBQWdBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFnQUNBQVFBQUFBZ0NBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc5MjEsImV4cCI6MTc4MjMxODcyMX0.2bkZ0eT_6XQOiJCgAfP_KG90w8pu6uupuKvovCKcmEU)

![](https://pingcode.yasdb.com/atlas/files/public/67396d658970c2af4f52127c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFJQUFBSUFBQWdBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFnQUNBQVFBQUFBZ0NBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc5MjEsImV4cCI6MTc4MjMxODcyMX0.2bkZ0eT_6XQOiJCgAfP_KG90w8pu6uupuKvovCKcmEU)

  


分区dc如何加载：

- 上级dc记录每个分区的partId，需要加载的时候直接unique scan（需要额外记录partId）


这个SR主要调整dc结构，代码改动量大，逻辑并没有很复杂，代码主要集中在由于dc结构改变而相应的代码调整以及懒加载相应逻辑，包括：

- 分区定位剪枝（一级分区partbound从分区挪到了表dc，二级分区partbound挪到了一级分区，相应代码调整）
- 表dc加载只需要加载一级分区partbound，每个分区的hash，创建一级分区partlist
- 第一次使用分区时发现是NULL，加载分区dc（加分区级别锁，一个分区只能一个人加载）
- 二级分区与一级分区处理一致
- 回收的时候自底向上回收（按照二级分区mctx->一级分区mctx->表mctx的顺序，同时清理对应hot cache）
- 懒加载各个地方加载分区dc的处理
- interval分区扩展
- 外键检查分区适配
- 懒加载后，集群同步适配（集群不同实例的分区dc加载情况不同，ddl同步有可能需要加载dc）
- 懒加载的时候，如果失败，要将这个part恢复（因为dc不会失效）


####   [二级分区懒加载](#二级分区懒加载)  

使用PartMember平替 TabPartDict，IdxPartDict。使用时，判断PartMember中part是否已加载。

```
typedef struct StPartMember {
    CodPointer member;   /* TabPartDict, IdxPartDict*/
    PartBound* bound;
    CodUint64  partId;
} PartMember;

```

二级分区表表dc加载的时候不加载一级分区，只加载一级分区partbound。二级分区表分区定位到一级分区后，发现一级分区未加载，先加载一级分区，然后再做二级分区分区定位。

- 加载表dc，只加载一级分区的partList，partList存储PartMember，其中包含part dc指针，partBound，partId
- 加载表dc时，需要初始化一级分区对应的bound hash，name hash，dataOid hash，使用dc mctx
- 加载表dc时，一级分区相关统计信息在表dc上，一并加载，使用dc mctx
- 当真正加载一级分区时，需要创建mctx，并挂到tabPartDict，同时只需要加载partDesc中内容，并加载entry，或者加载二级分区member
- 加载一级分区dc的时候，加载当前一级分区所属二级分区partList，partList存储PartMember
- 加载一级分区dc的时候，需要初始化所属二级分区对应的bound hash，name hash，dataOid hash，使用一级分区mctx
- 当真正加载二级分区时，需要创建mctx，并挂到tabPartDict，同时只需要加载partDesc中内容
- 懒加载过程中使用的内存都是新申请出来的mctx，如果失败，则一把释放mctx
- 懒加载过程中会set真实part dc指针，这个可以参考interval分区扩展，在全部加载完成后，一把set
- 懒加载后，索引设置表分区handler，可能表分区未加载，此时设置为PartMember，使用的时候发现没加载，再加载


**interval 分区扩展：**

- 扩展节点的分区需要加载上来，因为立马就要使用
- 集群同步，只需要同步加载PartMember，等使用的时候再加载


**懒加载时机：**

- startTableCursor的时候，如果发现PartMember中dc是NULL，则加载
- 不通过startTableCursor的操作，比如外键检查，需要使用分区时，则加载
- 需要计算二级分区partNum时，如果一级分区没加载，需要加载一级分区
- 全局索引回表，设置的PartMember可能part没加载，使用时需判断加载
- DDL执行的时候，需要哪个分区加载那个分区


###   [分区dc独立回收](#分区dc独立回收)  

分区dc独立mctx后，为了更加合理的使用dc pool，我们需要实现分区级的dc回收机制。

- 表dc的回收一并回收所有表分区的mctx
- 如果表不能回收，继续判断是否存在可以回收的分区，如果可以回收则回收分区mctx
- 单独分区回收时需要一并回收相关hot cache
- 如果表dc是invalid则不单独回收分区dc，等表一起回收？


当前dc回收以表为单位，回收前提是表dc的recCount是0并且表dc是invalid。为了回收分区dc，需要在dc有效时，判断分区dc是否可回收。啥时候可以回收？回收的前提：

- 这个分区确实很久没有使用
- 要避免刚回收，就又要访问
- 记录最后一次访问scn？阈值判定，多久没访问就可以失效


为了实现分区级别的mctx回收，需要保证分区回收的时候没有并发使用，与table相似，需要增加分区级别的refcount。

**分区cursor使用：当前是open一次，每个分区start一次，分区refCount修改时机：**

- startCursor的时候，访问分区dc，挂到cursor上，则refCount++
- 访问结束，refCount--。在哪里？需要找一个公共的地方（startCursor或者closeCursor的时候，如果发现当前cursor上有分区，则减1）
- 其他直接访问分区dc的地方，自己逻辑保证（使用前后加减）


失效分区dc流程：

- 判断分区能否失效时就已经加锁
- 设置上层dc的partlist对应当前分区位置为NULL
- 放锁
- 回收


分区refCount的修改以及分区dc的失效需要加锁，这个锁要在当前分区上一层mctx上。粒度应该如何弄（可以放在PartMember里面）

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

##   [9. 未来规划](#9-未来规划)  

分区级别ddl，只失效分区dc？

  


  


## Attachments:

[image2024-1-12_10-18-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjVhMWFkOWEzMzExZGM5MGVjIiwicmVmX2lkIjoiNjczOTZkNjU3MjgyMDZlZmI5MmYxZThlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3OTIxLCJleHAiOjE3ODIzOTQzMjF9.ICrFNRngHQfZrB2E-uaGBNGXc5ToGtgqkJWzU34AN9U)

 (image/png)    
