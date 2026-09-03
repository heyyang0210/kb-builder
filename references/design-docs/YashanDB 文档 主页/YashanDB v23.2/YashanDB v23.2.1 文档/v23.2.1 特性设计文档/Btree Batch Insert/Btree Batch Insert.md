Created by 张锐, last modified by  江祉涵 on 十一月 24, 2023

#   [Yashan Db Btree Batch Insert](#yashan-db-btree-batch-insert)  

IR:     [https://jira.yasdb.com/browse/YDBRD-22367](https://jira.yasdb.com/browse/YDBRD-22367)  

SR:     [https://jira.yasdb.com/browse/YDBRD-22548](https://jira.yasdb.com/browse/YDBRD-22548)  

##   [1. Overview（概述）](#1-overview概述)  

Yashan Db提供Btree 索引批插能力。

##   [2. Features（功能特性）](#2-features功能特性)  

1. 提供Btree索引批插接口
1. 支持回滚
1. 支持MVCC


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 只支持btree索引
- 其他索引还是逐个插入
- 不支持可串行化事务(退化为一般插入)


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

btree批插redo设计：

```
typedef struct StRecBtreeBatchInsert {
    CodUint16 count;
    CodUint16 unused;
    CodChar   data[0];  /* count RecBtreeInserts */
} RecBtreeBatchInsert;

```

btree批插undo设计：

```
typedef struct StUndoBtreeBatch {
    UndoBtreeHead head;
    CodUint16     count;
    CodUint16     udSlot;     /* record which row has not been rollbacked*/
    CodChar       data[0];    /* |size(CodUint16)|udKey| */
} UndoBtreeBatch;

```

###   [Btree索引批插流程：](#btree索引批插流程)  

- heap批插结束后，进入索引批插流程
- 将这一批row逐个插入一个内存btree block（插入过程中就会排好序）
- 当这个内存btree block插满或者这一批heap row都已经处理过时，调用btree批插接口，将这个内存block的所有key一次插入btree
- btree批插接口取第一个key，查找插入位置
- 根据插入位置生成插入redo、undo
- 判断下一个key是否可以在当前block上插入
- 如果可以插入则继续构造插入redo、undo，否则apply redo并且记录undo
- 当前block插入完毕，如果内存block内还有剩余key，则重新取还没插入的第一个key重复上述流程直到内存block key全部插入btree


###   [Btree索引批插流程图：](#btree索引批插流程图)  

![](https://pingcode.yasdb.com/atlas/files/public/67396c018970c2af4f52089e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlnQUJBQUFBQUFCQUFBZ0FBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFEQUFBQUFCQUFBQUFBQUFBQUNBQUFBSUFBQUVBQUVBQUFBQUFBQUFBQVFRQUFBQUFBQUFBQUFJQUFFQUFBRUFJQUFBQUFBQUFBQUFNQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NjEsImV4cCI6MTc4MjMwOTI2MX0.Sp-GrFGHih9W8Pzfbwra8oM0dKWS9J5znNMuIMDkhqM)

###   [Btree索引批插判断是否可以插入逻辑](#btree索引批插判断是否可以插入逻辑)  

批插要判断一个key是否可以在当前block上插入，由于已经有一个key插入当前block，所以只需判断当前key是否超过了当前block的上限。当这个key比当前页面的所有key都大时，则需要根据parent key来判断。所以YashanDb在批插查找插入位置的时候，把当前block的下一个block的parentkey存储在了location上。

Btree批插查找插入流程：

- 在每一层查找到位置后，如果当前level > 0，则把当前slot的下一个slot的parent key拷贝到location（如果不存在则不拷贝）


判断逻辑：

- 如果上一个key的插入位置的下一个slot >= block->keys
-     1. 如果当前block不存在右兄弟，则当前block是btree的最右边的leaf block，则当前key只能插入当前block的最后一个slot
    1. 如果当前block存在右兄弟，则说明在查找的时候，location已经存储了当前block的上限parent key。判断当前key与location->nextMaxKey的大小关系
    1.         - 2.1 如果当前 key < location->nextMaxKey，则当前key需要插入当前block的最后一个slot
        - 2.2 否则，当前key不能插入当前block


- 如果block上的下一个key大于下一个要插入的key则直接插入在后一位
- 否则在当前block二分查找，
-     1. 如果查找的slot < block->keys则可以插入当前block
    1. 否则需要判断当前key与location->nextMaxKey的大小关系

    - 2.1 如果当前 key < location->nextMaxKey，则当前key需要插入当前block的最后一个slot
    - 2.2 否则，当前key不能插入当前block


###   [Btree索引批插Redo与Undo的逻辑](#btree索引批插redo与undo的逻辑)  

- 批插一次插入一批key，所以在attach页面之前，假设这一批key全部可以插入，prep可以容纳这么多key的undo
- attach到一个block后，直接rdPut批插日志，按照最大个数put
- 每一个key插入前，记录undo信息包含要记录的undo key指针以及key size
- 真正插入前，判断是全部插入，如果不是，修改put的redo上面的插入count
- 写undo


###   [Btree批插回滚逻辑](#btree批插回滚逻辑)  

由于批插的undo记录了若干key，所以可能一个原子操作并不能回滚完。所以Btree批插的回滚设计了一个多个原子操作共同完成的rollback，流程如下：

- 首先根据segment，拿到btree信息
- 根据undo里记录的udSlot，定位到udSLot key的offset
- 从udSlot key开始回滚，开启原子操作，attach 页面
- attach上的页面，把属于这个undo的所有key都回滚，根据undo是否完结修改undo row
- 结束原子操作
- 如果当前undo row已经回滚完成，则结束。否则重复上述流程


Btree批插回滚一个block流程：

- 在回滚一个key前，首先判断下一个要回滚的key是否在当前block
-     1. 如果在，则记LOGT_BTREE_UNDO_BATCH_KEY日志（apply的时候不undo xslot）
    1. 如果不在，则记LOGT_BTREE_UNDO_LEAF_KEY（apply的时候会undo xslot）

- 回滚当前key，如果下一个key在当前block，则重复上述流程
- 判断当前回滚是否完成
-     1. 已经完成则执行udApplied
    1. 没有完成，则修改undo row的 udSlot为下一个要undo的key



###Btree批插回滚流程图：

![](https://pingcode.yasdb.com/atlas/files/public/67396c01a1ad9a3311dc8713/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlnQUJBQUFBQUFCQUFBZ0FBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFEQUFBQUFCQUFBQUFBQUFBQUNBQUFBSUFBQUVBQUVBQUFBQUFBQUFBQVFRQUFBQUFBQUFBQUFJQUFFQUFBRUFJQUFBQUFBQUFBQUFNQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NjEsImV4cCI6MTc4MjMwOTI2MX0.Sp-GrFGHih9W8Pzfbwra8oM0dKWS9J5znNMuIMDkhqM)

###   [Btree索引批插Revert逻辑](#btree索引批插revert逻辑)  

Btree索引批插的revert相当于若干个btree insert的revert，从udSlot开始，逐行revert。

###   [唯一索引的批插](#唯一索引的批插)  

在索引批插找到第一个key对应block时检查插入的key是否满足唯一约束。后续key在插入前同样要检查插入是否会违反唯一约束，若违反则将该key之前的所有key记录undo插入并返回错误，后续通过回滚回退整个插入操作。

###   [性能](#性能)  

一下为插入100w行数据批插耗时，第一行数据为顺序，第二行为随机，第三行为倒叙

![](https://pingcode.yasdb.com/atlas/files/public/67396c01a1ad9a3311dc8715/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlnQUJBQUFBQUFCQUFBZ0FBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFEQUFBQUFCQUFBQUFBQUFBQUNBQUFBSUFBQUVBQUVBQUFBQUFBQUFBQVFRQUFBQUFBQUFBQUFJQUFFQUFBRUFJQUFBQUFBQUFBQUFNQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NjEsImV4cCI6MTc4MjMwOTI2MX0.Sp-GrFGHih9W8Pzfbwra8oM0dKWS9J5znNMuIMDkhqM)

![](https://pingcode.yasdb.com/atlas/files/public/67396c018970c2af4f5208a1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlnQUJBQUFBQUFCQUFBZ0FBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFEQUFBQUFCQUFBQUFBQUFBQUNBQUFBSUFBQUVBQUVBQUFBQUFBQUFBQVFRQUFBQUFBQUFBQUFJQUFFQUFBRUFJQUFBQUFBQUFBQUFNQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NjEsImV4cCI6MTc4MjMwOTI2MX0.Sp-GrFGHih9W8Pzfbwra8oM0dKWS9J5znNMuIMDkhqM)

![](https://pingcode.yasdb.com/atlas/files/public/67396c018970c2af4f5208a3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlnQUJBQUFBQUFCQUFBZ0FBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBUUFBQUFEQUFBQUFCQUFBQUFBQUFBQUNBQUFBSUFBQUVBQUVBQUFBQUFBQUFBQVFRQUFBQUFBQUFBQUFJQUFFQUFBRUFJQUFBQUFBQUFBQUFNQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0NjEsImV4cCI6MTc4MjMwOTI2MX0.Sp-GrFGHih9W8Pzfbwra8oM0dKWS9J5znNMuIMDkhqM)

由此图可知若插入数据为顺序则索引批插要比不批插块一倍，若插入的数据无序则性能几乎相同。    
  这是因为当数据十分无序的时候每次批插只能在一个block上插入一个key导致批插退化为了一般插入，再加上构建批插block的排序的消耗甚至性能会不如一般插入。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

  


## Attachments:

[image2022-2-17_15-43-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDA4OTcwYzJhZjRmNTIwODk2IiwicmVmX2lkIjoiNjczOTZjMDA3MjgyMDZlZmI5MmYwYzgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDYxLCJleHAiOjE3ODIzODQ4NjF9.daXDKg03PA4kH8xpmz0vs2jQRLmjaRSc_4Pc-m_dDy0)

 (image/png)    


[Untitled Diagram.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMDA4OTcwYzJhZjRmNTIwODk4IiwicmVmX2lkIjoiNjczOTZjMDA3MjgyMDZlZmI5MmYwYzgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDYxLCJleHAiOjE3ODIzODQ4NjF9.IoLg2rGevmieVyxHLMBG9JJx6ky31wK3OiGhE2FoV-M)

 (image/png)    


## Comments:

|  [](null)  ,可串行化事务退化为一般插入,Posted by jiangzhihan at 十一月 20, 2023 11:19|
|---|
