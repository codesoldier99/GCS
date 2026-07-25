import { useState } from 'react'
import { Icon, type IconName } from '../Icon'
import { useMission } from '../../state/missionStore'
import { ConfirmDialog } from '../ConfirmDialog'

function Tool({
  icon,
  title,
  active,
  disabled,
  danger,
  onClick
}: {
  icon: IconName
  title: string
  active?: boolean
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`icon-btn${active ? ' active' : ''}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={danger && !active ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}
    >
      <Icon name={icon} size={19} />
    </button>
  )
}

export function WaypointToolbar(): JSX.Element {
  const addMode = useMission((s) => s.addMode)
  const setAddMode = useMission((s) => s.setAddMode)
  const setHomeMode = useMission((s) => s.setHomeMode)
  const toggleSetHomeMode = useMission((s) => s.toggleSetHomeMode)
  const selected = useMission((s) => s.selected)
  const count = useMission((s) => s.mission.waypoints.length)
  const canUndo = useMission((s) => s.past.length > 0)
  const canRedo = useMission((s) => s.future.length > 0)
  const openDialog = useMission((s) => s.openDialog)
  const deleteWaypoint = useMission((s) => s.deleteWaypoint)
  const clearAll = useMission((s) => s.clearAll)
  const undo = useMission((s) => s.undo)
  const redo = useMission((s) => s.redo)
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <div
      style={{
        position: 'absolute',
        right: 14,
        top: 14,
        maxHeight: 'calc(100% - 28px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 6,
        paddingRight: 2
      }}
    >
      <Tool
        icon="plus"
        title={addMode ? '退出加点模式' : '添加航点（点击地图落点）'}
        active={addMode}
        onClick={() => setAddMode(!addMode)}
      />
      <Tool
        icon="home"
        title={setHomeMode ? '退出设置起飞点模式' : '设置起飞点（点击地图落点）'}
        active={setHomeMode}
        onClick={() => toggleSetHomeMode()}
      />
      <Tool icon="crosshair" title="相对坐标编辑器" onClick={() => openDialog('relcoord')} />
      <Tool icon="compass" title="航线变换（旋转/平移/反序）" onClick={() => openDialog('transform')} />
      <Tool icon="wave" title="航线模板（圆形/弓形/星形）" onClick={() => openDialog('template')} />
      <div style={{ height: 4 }} />
      <Tool
        icon="trash"
        title="删除当前航点"
        danger
        disabled={selected == null}
        onClick={() => selected != null && deleteWaypoint(selected)}
      />
      <Tool icon="eraser" title="清空所有航点" danger disabled={count === 0} onClick={() => setConfirmClear(true)} />
      <Tool
        icon="target"
        title="显示所有航点"
        disabled={count === 0}
        onClick={() => window.dispatchEvent(new Event('mission-fit'))}
      />
      <div style={{ height: 4 }} />
      <Tool icon="undo" title="撤销" disabled={!canUndo} onClick={undo} />
      <Tool icon="redo" title="重做" disabled={!canRedo} onClick={redo} />
      <Tool icon="list" title="航点列表 / 上传下载" onClick={() => openDialog('list')} />

      {confirmClear && (
        <ConfirmDialog
          title="清空所有航点"
          message={`确认清空全部 ${count} 个航点？此操作可撤销。`}
          danger
          onConfirm={() => {
            clearAll()
            setConfirmClear(false)
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}
