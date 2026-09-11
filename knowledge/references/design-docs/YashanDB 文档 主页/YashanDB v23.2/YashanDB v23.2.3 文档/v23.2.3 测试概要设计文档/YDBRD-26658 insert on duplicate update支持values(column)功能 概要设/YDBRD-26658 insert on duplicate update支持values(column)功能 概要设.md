Created by 刘清萍, last modified on 五月 20, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

*需求来源：*  *地铁云管平台*

*功能概述：insert on duplicate update支持values(column)功能*

*需求范围：单机、集群行存*

  [https://pingcode.yasdb.com/pjm/items/66290f05fd997db58ae12907](https://pingcode.yasdb.com/pjm/items/66290f05fd997db58ae12907)    *?*  *  
*  *#YDBRD-26658 insert on duplicate update支持values(column)功能*

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

**使用场景**  ：  insert into t_1 (a,b,c) values (1,2,3) on duplicate key update a=values(a),b=values(b),c=values(c);，values(column)的值为values (1,2,3)对应的字段值

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

  对齐mysql

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

*需求范围：*  *  
*  *1、单机行存*

*2、集群行存*

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

       1、关注用例复用情况，之前duplicate语法改写用例 直接复用

       2、约束

          a.insert表存在约束情况下插入，测试更新值违反约束情况表现（关注default值插入）

          b.不存在约束插入

       3、  a=values(a)括号内填入const、多列列名、子查询、表达式 和mysql对比报错

       4、  a=values(a)（values和values加减乘除组合、括号内使用不对应列名打乱顺序、不存在列名补null)

       5、insert into t1(c3,c2,c1) 打乱顺序插入

       6、关注普通表、分区表（跨分区更新）

       7、已有update语法和values语法组合

       8、insert多值（部分冲突回退）

       9、多个主键，update顺序

       10、此语法不支持update多列   



###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

关注ct/kt

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

自动化看护

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

无

  
