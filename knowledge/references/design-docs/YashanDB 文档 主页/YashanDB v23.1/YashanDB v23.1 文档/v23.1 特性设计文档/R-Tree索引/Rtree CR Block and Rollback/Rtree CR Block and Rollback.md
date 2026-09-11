Created by 张锐, last modified on 六月 26, 2023

##   [Rtree CR Block and Rollback](#rtree-cr-block-and-rollback)  

Rtree有一部分记录的undo就是btree的undo，并且revert/rollback的逻辑也一样，一样的undo如下：

- UNDO_BTREE_SPLIT
- UNDO_BTREE_ALLOC_BLOCK
- UNDO_BTREE_LOCK_BLOCK


对于这几种undo类型的revert/rollback，详见    [Btree CR Block and Rollback](https://conf.yasdb.com/display/YAS/Btree+CR+Block+and+RollBack)    。

###   [Rtree Undo类型](#rtree-undo类型)  

- UNDO_RTREE_INSERT
- UNDO_RTREE_DELETE
- UNDO_RTREE_BRANCH_INSERT
- UNDO_RTREE_BRANCH_UPDATE
- UNDO_RTREE_COMPACT


###   [Rtree CR Block构建](#rtree-cr-block构建)  

Rtree CR Block构建的基本原则与btree一致，参见：    [Btree CR BLock构建](https://conf.yasdb.com/display/YAS/Btree+CR+Block+and+RollBack#22-btree-cr-block%E7%9A%84%E6%9E%84%E5%BB%BA)    。

####   [Leaf Block Revert](#leaf-block-revert)  

leafBlock的普通事务xslot在split的时候会copy一份给new block，所以在split的时刻，原始block还没有提交的xslot在split后会出现2份。多次split还有可能让这些xslot出现多份。但是一次dml操作只发生在一个key上，所以这多个xslot在revert的时候，只需要处理一个。

leafBlock的普通事务的revert遵循以下几个原则：

- insert和delete的revert不在block上插入key
- 只有compact的undo会在block上插入key
- insert和delete的revert在当前block如果找不到key则啥都不做（说明需要处理的key在别的block）
- revert insert如果当时key是新插的则直接擦掉key，如果当时key是reuse空间的，则把undo key覆盖在当前key上
- revert delete直接将当前key标记为deleted，并且维护deletedKeys和空间
- revert compact把undo中记录的key全部重新插入当前block


上述原则rtree与btree一致，只是查找不同。Btree可以做二分查找，rtree只能通过遍历，做isSame查找

####   [Branch Block Revert](#branch-block-revert)  

对于rtree而言，现阶段只有insert和update。由于branch block的所有操作都是使用0号xslot，所以branch block直接按照0号xslot串行revert就可以。

- revert branch insert直接擦掉目标slot key
- revert branch update直接将undo key拷贝到目标slot


####   [Structure Operation Revert](#structure-operation-revert)  

对于UNDO_BTREE_SPLIT，UNDO_BTREE_ALLOC_BLOCK和UNDO_BTREE_LOCK_BLOCK这三种类型undo，rtree行为与btree一致。只有compact记的undo，rtree的revert逻辑和btree不一样。

rtree revert compact会将compact掉的deleted key全部插回block，插入的slot是顺序往后插入（这点和btree，不一样，btree需要维护key的顺序。rtree对于一个block内的key，顺序没有影响，所以直接往后插入），同时维护block的空间信息。

###   [Rtree Rollback](#rtree-rollback)  

Rtree Rollback的基本原则与btree一致，参见:    [Btree Rollback](https://conf.yasdb.com/display/YAS/Btree+CR+Block+and+RollBack#23-btree-rollback)    。

####   [Leaf Block Rollback](#leaf-block-rollback)  

Rtree rollback leaf key的时候，查找undo key的逻辑与rtree delete key的逻辑一致，参见：    [Rtree Delete](https://conf.yasdb.com/display/YAS/Rtree+Structure+and+Basic+Operation#rtree-delete)    。

- undo insert先根据undoKey找到key所在的位置，如果插入的时候是新插的，则直接擦掉这个key，如果是重用空间则直接拷贝undoKey回去，同时维护空间
- undo delete先根据undoKey找到key所在的位置，修改key的deleted标记为false，同时维护空间


####   [Branch Block Rollback](#branch-block-rollback)  

由于branch block的操作是串行的，所以undo的时候直接在原block操作即可。

- undo branch insert直接擦掉目标slot key
- undo branch update直接将undo key拷贝到目标slot


####   [Structure Operation Rollback](#structure-operation-rollback)  

对于UNDO_BTREE_SPLIT，UNDO_BTREE_ALLOC_BLOCK和UNDO_BTREE_LOCK_BLOCK这三种类型undo，rtree行为与btree一致。只有compact记的undo，rtree的rollback逻辑和btree不一样。

rtree rollback compact会将compact掉的deleted key全部插回block，插入的slot是顺序往后插入（这点和btree，不一样，btree需要维护key的顺序。rtree对于一个block内的key，顺序没有影响，所以直接往后插入），同时维护block的空间信息。