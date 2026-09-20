# Memory 治理

## 分层

1. 观察：真实评审、用户反馈、实施和验收的原始记录，保存在 `runtime/skill-evolution/product-experience-critique/observations/`。
2. 候选：从已验证案例抽象的可复用原则，保存在运行期 `candidates/`。
3. 正式 Memory：通过 Eval 且经人类确认的原则、模式、反模式和案例，保存在 Skill 的 `memory/`。

## 候选结构

```yaml
sourceCases: []
observedPattern: ""
rootCause: ""
reusablePrinciple: ""
applicableWhen: []
notApplicableWhen: []
counterexample: ""
effectEvidence: []
confidence: low | medium | high
```

## 晋升条件

- 通常至少由两个独立案例支持，或属于权限、数据安全、错误事实、不可恢复操作等单案例高影响原则。
- 必须有适用条件、不适用条件、反例和实施效果证据。
- 新规则必须通过 `evals/` 中的硬门禁和历史核心案例，且不增加误触发。
- 新规则应替代、合并或精炼旧规则，不只能追加。
- 正式晋升由人类确认；自动化只生成变更提案和 Eval 证据。

## 退役

当原则与当前设计冲突、连续产生无效建议、已由确定性门禁完全取代，或已不再适用当前业务时，删除或降级为历史案例。
