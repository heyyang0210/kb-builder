Created by 王海峰, last modified on 十一月 13, 2024

概要设计-YASHAN-3195 UDT变量的存取访问性能优化

IR链接：    [https://pingcode.yasdb.com/ship/ideas/66cd90a689f961f33010064c](https://pingcode.yasdb.com/ship/ideas/66cd90a689f961f33010064c)    ?    
  #YASHAN-3195 UDT变量的存取访问性能优化

##   [1. 总述](#1-总述)  

需求来源：UDT变量在外场使用过程中反馈存取效率较低

需求分析：在PL/SQL语言中，UDT变量实现复杂度较高，主要体现在UDT变量的编址、寻址、校验等实现较为复杂，需要针对较大的额外开销进行处理。

功能概要描述：

（1）INDEX-BY表类型按ObjectArray实现，未采用高效的数据结构，导致在数据量上去后，存取效率很低。

（2）UDT变量的类型合法性校验动作，可能存在多次校验，确保在一次执行过程中只要做一次。

（3）增加局部缓存，进行提速。

###   [1.1 需求来源](#11-需求来源)  

需求来源已描述。在外场提供的业务应用脚本中，同时测试了OB、达梦、Oracle和YashanDB。在基础的场景下（循环 + 变量读取 + 变量赋值），YashanDB对应的UDT特性实现性能明显低于Oracle。跟国内其他数据库的访问效率差距也比较明显。

分析应用脚本，主要围绕特性包括：

（1）使用到了INDEX-BY表（又叫associate array，关联数组）类型的读取、写入；

（2）BULK特性INTO到TABLE变量写入；

（3）PACKAGE全局变量区下的数组变量访问。

从需求描述上可以看出，该需求主要是解决特定场景问题的性能特性要求，因为性能调整可能涉及底层结构实现，所以需要进行功能角度覆盖，但其他质量属性涉及较少。而且本需求并不与部署形态绑定，主备(单机)、分布式、集群均支持，不区分行列。

###   [1.2 调研文档](#12-调研文档)  

该需求为O兼容性需求。在友商有相同的需求实现情况。性能情况描述分为以下3个场景：

（1）INDEX-BY表类型变量的存取效率

（2）TABLE变量的存取效率

（3）PACKAGE全局变量区下的数组变量访问

###   [1.3 需求分析](#13-需求分析)  

从需求描述上可以看出，该需求主要是解决特定场景问题的性能特性要求，主要为了解决在业务应用中PL整体性能效率较低的情况。对于其他的非功能质量属性，该需求并不涉及。

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|INDEX-BY表变量存取功能的正确性|无特别设计|是|是|----|
||TABLE变量存取功能的正确性|无特别设计|是|是|----|
||数组变量存取功能的正确性|无特别设计|是|是|----|
||PACKAGE全局变量区下的变量存取功能的正确性|执行的首次变量访问产生校验动作，在同一个执行下，变量没有反复校验是否失效的必要性，正确性可以保证。|是|是|----|
|性能|INDEX-BY表变量的存取效率|从ObjectArray改写成rbTree，减少插入和key查找代价|是|是|----|
||TABLE变量的存取效率|在ObjectArray基础上，增加加速结构查找value|是|是|----|
||PACKAGE全局变量区下的变量存取效率|减少PACKAGE全局变量区的有效性校验|是|是|----|
|可用性|不涉及|----|否|否|----|
|可靠性|不涉及|----|否|否|----|
|可维可测|SQL语句出现报错，错误抛出策略|----|是/否|是/否|----|
|安全|不涉及|----|否|否|----|
|易用性|不涉及|----|否|否|----|
|可修改性|不涉及|----|否|否|----|
|兼容性|不涉及|----|否|否|----|
|周边配合|权限|----|----|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导入导出工具|----|----|否|----|


###   [1.4 数据字典](#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|INDEX-BY表|关联数组，KEY+VALUE的一种呈现形式。|是||


###   [1.5 开源依赖](#15-开源依赖)  

未使用任何开源组件。

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|UDT变量类型的存取语法|聚焦于存取效率，同时时延呈现|是|
|函数|----|----|否|
|高级包|----|----|否|
|系统视图|----|----|否|
|动态视图|----|----|否|


##   [3. 规格与约束](#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](#4-特性)  

存取效率的优化，概括的来说是变量管理路径的优化。因为UDT类型的变量，功能丰富，组织形式复杂，所以UDT类型变量的编址如果走EXPR_ACCESS相对于其他类型更为复杂，计算时指令数较多。同时在执行过程中，为了能检测出类型变化，经常会进行一些校验动作。

###   [4.1 INDEX-BY表变量的存取](#41-index-by表变量的存取)  

从外场反馈的场景分析来看，INDEX-BY表的变量，在大循环中的存取效率表现极低。

```
  type Tab_bond is table of Rec_bond;
  type Tab_BondWithKey is table of number(12) index by varchar2(128);
  
  vTab_Bond Tab_bond := Tab_bond();
  vTab_BondIdxByMktIsin Tab_BondWithKey;
  vTab_BondIdxById Tab_BondWithKey;
  vc_key                     varchar2(100);
begin
  select fl_securityid, fc_securitycode, fc_chinesename, fc_securitymarket, fl_securitytypes, fc_isin, fl_securitytypeextone, fc_currency,
         ff_facevalue, ff_issueprice, fd_valuedate, fd_duedate, fl_netorfull, fl_ratetype, fl_intpaymeth, fl_cappaymeth, fl_intcalmeth,
         fl_intcalmethdue, fd_firstpaydate, fl_right, fl_clearhouse, ff_taxrate, fd_rightdate, sysdate, 0, fd_auditdate,
         fl_auditor, ff_interestrate, ff_exchrate_gd, fl_issuertype, fd_convertbegindate, fd_convertenddate, fl_guarantee, fl_issuerid,
         fl_guaranteeid, ff_callprice, fc_issueperiod, fd_issuebegindate, fd_issueenddate, ff_totalbondissue, fl_intcalmode, fl_intcalmodedue,
         fl_originalownerid, fl_priorityflag, fl_perpetualflag, fl_automation, fl_accountingclass, fl_issuemode, fl_securityid_ib, fc_industryno,
         fc_industryno_capco, 0 fl_flag
    bulk collect into vTab_Bond
    from tc_secbond;
    --  分析 优化方向：1.每行按列获取，SCAN读取代价怀疑较大 （走批量读取模式？）
    --          2.into的table变量，每次按i地址寻址代价是否可优化？
    --  实测 随着tc_secbond表的数据量增多，该查询语句耗时增大，但相对友商的劣化幅度没有那么明显
    
  if vTab_Bond.count &gt; 0 then
    for i in vTab_Bond.first..vTab_Bond.last loop
      vc_key := vTab_Bond(i).fc_isin||'_'||vTab_Bond(i).fc_securitymarket||'_'||vTab_Bond(i).fl_securitytypes; -- 1.VARCHAR运算效率 2. TABLE寻址代价
      vTab_BondIdxByMktIsin(vc_key) := i;

      vc_key := vTab_Bond(i).fl_securityid;
      vTab_BondIdxById(vc_key) := i;
      --  分析 优化方向:1.减少udt的寻址代价，类似使用中间变量（标量形式）进行缓存
      --         2.80和83的index by变量寻址赋值代价可能很大，指令数过多？函数层级过高？降低主流程上指令开销；去除无效初始化；
      --         3.UDT变量的执行校验改成首次校验
      --         如果是package变量减少package的寻址代价
      --         简单的循环赋值，进行改写成批量赋值

	  --  实测 随着vTab_Bond的数据量增多，该循环语句劣化十分明显
      end loop;
  end if;
end;

```

从实测结果来看，FOR循环语句中的vTab_BondIdxByMktIsin、vTab_BondIdxById赋值语句随着vTab_Bond数据量（去重值）增多，劣化性能十分明显。用户下的表数据约在14w左右，YashanDB的表现明显比O记落后接近60倍。该场景下通过火焰图抓取分析，主要开销在INDEX-BY表的objectArrayAdd函数上。

分析INDEX-BY表的业务特点，可以得到INDEX-BY表要呈现的是有序的KEY-VALUE对形式，而objectArray只是提供了一个数组形式链表，分析当数值越多，objectArray本身内部为了腾挪数组位置产生搬迁动作越多（基本无重复值情况下，最恶劣的搬迁代价接近n（n+1）/2）。经此分析，决定回归INDEX-BY表的本意，借鉴业界TreeMap的标准实现，将INDEX-BY的存放结构调整为红黑树形式（算法代码在logN）。按此调整预计有较大提升。预期验证效果可接近O。

###   [4.2 TABLE变量的存取](#42-table变量的存取)  

从外场反馈的场景2分析来看，    [https://conf.yasdb.com/pages/viewpage.action?pageId=163014174，主要聚焦第一个性能差距点：](https://conf.yasdb.com/pages/viewpage.action?pageId=163014174%EF%BC%8C%E4%B8%BB%E8%A6%81%E8%81%9A%E7%84%A6%E7%AC%AC%E4%B8%80%E4%B8%AA%E6%80%A7%E8%83%BD%E5%B7%AE%E8%B7%9D%E7%82%B9%EF%BC%9A)  

```
UDT存取性能比oracle慢8倍，有20%的代码是UDT存取10万个集合元素，循环10次，每次18个存取。yashanDB耗时：12.289&nbsp; &nbsp;oracle:1.547
SAISSUE-556-【国信融选POC】循环体里package的table类型变量重复取值导致性能比oralce慢9倍&nbsp;

```

原始UDT变量的访问产生较大的代价。分析普通TABLE变量的实现结构和流程，TABLE变量分成两种寻址结构，一种直接访问TABLE变量本身，使用的是EXPR_SOVAR；一种访问TABLE变量的成员（儿子or孙子or方法），使用的是EXPR_ACCESS。在当前存取情况下，会使用ACCESS表达式。简单的循环结构产生了较大的性能差距。所以需要有一个加速结构缩小该差距。

目前计划使用一个hash map来加速，key使用 原始表达式 + 循环变量的值， value指向最终域段的value ptr。优化效果至少达到局部缓存效果，预计该场景下性能提升30%左右。需要实测给个结果。进一步提升可能有困难，预计要直面ACCESS表达式的改写。

###   [4.3 PACKAGE全局变量区下的变量存取](#43-package全局变量区下的变量存取)  

实际效果是，在1000w数据下普通虚拟机，针对全局变量和局部变量的访问，存在30%左右的差异（4.2s和2.9s的差异）。

分析PACKAGE全局变量与局部变量的代价差异，分析代码路径上的主要区别在于每一次全局变量的获取，都多余增加了基于全局变量区版本是否可靠的有效性判定。方案上调整修改成PACKAGE变量在首次访问时进行校验。

##   [5.未来规划](#5未来规划)  

UDT的变量，目前编址加速结构较少。与友商的性能差距实现较为明显。针对性调整后，缩小一些差距。后续进一步优化方向，ACCESS表达式改成更为高效结构 和 编译执行。

## Attachments:

[image2023-11-15_9-19-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjI4OTcwYzJhZjRmNTIxYzk2IiwicmVmX2lkIjoiNjczOTZlZjE1OTNmOTljOWZmMjM4YjQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTMxLCJleHAiOjE3ODI1NDI5MzF9.2qpdG9qCZzV0EZwFUBkDg_JTNJPZV2yrmkvIUobLknc)

 (image/png)    


[image2023-11-15_9-18-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjI4OTcwYzJhZjRmNTIxYzk3IiwicmVmX2lkIjoiNjczOTZlZjE1OTNmOTljOWZmMjM4YjQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTMxLCJleHAiOjE3ODI1NDI5MzF9.YtMx2n6ZW6zsFQuStL7mVZXee5W9ERCzwuvw2X-w_oI)

 (image/png)    


[image2023-11-15_9-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZjI4OTcwYzJhZjRmNTIxYzk4IiwicmVmX2lkIjoiNjczOTZlZjE1OTNmOTljOWZmMjM4YjQwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2NTMxLCJleHAiOjE3ODI1NDI5MzF9.QXFJMUzeoJw7t0Fj-KpW1XspL4okJHlszBuJUkkX5Mk)

 (image/png)    
