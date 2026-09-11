Created by 张锐, last modified on 六月 26, 2023

##   [Rtree索引结构](#rtree索引结构)  

Rtree索引的物理页面结构与Btree索引一致，参见：    [Btree Structure and Basic Operation](https://conf.yasdb.com/display/YAS/Btree+Structure+and+Basic+Operation#btree-%E7%B4%A2%E5%BC%95%E7%BB%93%E6%9E%84)  

Rtree索引是一个高度平衡树，他是Btree索引在n维空间的扩展。Rtree存储的key是Geometry对象的MBR（Minimum Boundary Rectangle），采用空间聚集的方式把相邻近的Geometry对象划分在一起，组成更高一级的节点；在更高一层又根据这些节点的MBR进行聚集，划分形成更高一级的节点，直到所有Geometry对象组成一个Root节点。

![](https://pingcode.yasdb.com/atlas/files/public/67396a43a1ad9a3311dc7bdb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFJQUFBQUFBQUFBQUFRSUFBZ0FBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUVBQUFBQUFBQUFBQ0FJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIzMjMsImV4cCI6MTc4MjIyMzEyM30.UD1r4OWpno0mWCqFhY8Jt-mRE6-9Xo8MLVc3aCG_BhU)

![](https://pingcode.yasdb.com/atlas/files/public/67396a438970c2af4f51fd64/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFJQUFBQUFBQUFBQUFRSUFBZ0FBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUVBQUFBQUFBQUFBQ0FJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIzMjMsImV4cCI6MTc4MjIyMzEyM30.UD1r4OWpno0mWCqFhY8Jt-mRE6-9Xo8MLVc3aCG_BhU)

##   [Rtree Key结构](#rtree-key结构)  

Rtree Key结构物理上就是包含1列数据的Btree Key（Btree Key结构参见：    [Btree Structure and Basic Operation](https://conf.yasdb.com/display/YAS/Btree+Structure+and+Basic+Operation#btree-key%E7%BB%93%E6%9E%84)    ）。对于一个n维的rtree而言，它的一个key除了head外，包含了一列数据，这列数据存储了2n个float（或者double），依次表示一个MBR第i个维度的最小坐标和最大坐标。Branch block的head存储了4字节的blockId，指向了它下一层的child block，leaf block的head存储了8字节的leaf key head，存储了key的元信息与rowid相关信息。一个3维的rtree key结构如下（如果存储的是float，则size = 24， leaf key总大小为33）：

![](https://pingcode.yasdb.com/atlas/files/public/67396a43a1ad9a3311dc7bdc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFJQUFBQUFBQUFBQUFRSUFBZ0FBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUVBQUFBQUFBQUFBQ0FJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIzMjMsImV4cCI6MTc4MjIyMzEyM30.UD1r4OWpno0mWCqFhY8Jt-mRE6-9Xo8MLVc3aCG_BhU)

##   [Rtree Insert](#rtree-insert)  

插入原则：使插入路径需要扩展的MBR的大小最小。为了让每一次插入都能找到最优的插入选择，我们保证每一次的查找均是正确的，查找步骤如下：

- 在进入root前，取current scn作为这一次查找的searchScn
- 每进入一个block，首先判断0号xslot上是否事务没有结束，如果没有结束则等待这个事务结束后重新进入root查找
- 如果block的level与当前查找的level不匹配，则需要重新进入root查找
- 如果searchScn < xslot0的scn，则需要重新进入root查找
- 在当前block查找适当的slot


对于branch block来说，查找slot是遍历每一个key，计算待插入MBR进入后，需要扩展的MBR大小，选择最小扩展的key。如果遇到有一个key的扩展是0，则选择当前slot。如果branch block选取的slot需要扩展MBR，则做出记录。对于leaf block而言，遍历每个key，看是否有isSame插入（与待插入key一模一样，包含rowid），如果有isSame插入，则插入isSame的slot，否则slot就是block的keys。

插入一个Rtree Key有以下几个步骤：

- 查找待插入key需要杀入的位置，leafBlock id和slot
- 判断是否需要扩展插入路径的MBR，如果需要扩展，开启自治事务，自底向上扩展MBR
- 判断是否需要split，如果需要split，开启自治事务，split
- 判断是否需要compact，如果需要则compact（compact with undo需要开启自治事务）
- 分配xslot登记事务信息
- 写undo，进行插入


##   [Rtree Delete](#rtree-delete)  

Rtree查找一个特定的key，相当于自上而下，branch查找包含key的MBR，leaf block查找isSame。这个过程不像btree一样，每一层都可以找到一个确定的位置，rtree需要把每一个满足条件的block都进行遍历。所以rtree的delete相较于btree的delete，比较耗时。依次查找的流程如下：

- 每进入一个页面，首先判断0号xslot上是否事务没有结束，如果没有结束则等待这个事务结束后重新进入root查找
- 判断当前页面相比于上一次进入查找是否发生了变化（通过比较0号xslot的xid，初始给的xid为invalid，invalid是没有变化）
- 记录blockId，和0号xslot xid
- 如果当前页面发生了变化，则当前block->level > 0(因为只有向上查找才会发生变化)，遍历key，查找上一次遍历的key的位置（通过找location->blockId[currLevel - 1]来确定），如果找到了，则是从lastSlot的下一个slot查找第一个包含key的MBR；如果没找到，则找当前页面第一个包含查找key的mbr
- 如果当前页面没有发生变化，则从lastSlot的下一个slot开始遍历key，查找满足条件的MBR。branch block查找包含key的MBR，leaf block查找isSame的key
- branch block查找到一个MBR后向下查找子树，leaf block如果找到了isSame，则这个key就是要删除的key
- 如果当前页面已经查找完，则向上查找（向上查找可能会触发变化后的查找）


Rtree delete的查找，不像insert那样要完全保证查找路径是一个稳定的（通过进入root前取searchScn保证）。因为rtree的split一定是向右split，所以即使rtree split了，查找也不会漏。

##   [Rtree Update](#rtree-update)  

rtree update相当于先delete老键值的key，再插入新键值的key。

##   [Rtree数据结构](#rtree数据结构)  

key和block与btree相同

###   [segment](#segment)  

```
typedef struct StRtreeSegmentBlock {
    BlockHead    head;
    SegmentBase  base;
    ExtentsCtrl  extCtrl;
    SsmInfo      ssmInfo;
    SpaceBlockId root;
    CodUint8     dimension;
    CodUint8     dataType;    // point data type
    CodUint8     rtreeVer : 7;
    CodUint8     recordOid : 1;
    CodUint8     unused;
    CodUint8     reserved[304];
    ExtentsMap   extentMap;
} RtreeSegBlock;

```

## Attachments: